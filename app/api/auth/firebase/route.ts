import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  idToken: z.string().min(1).max(10_000),
  mode: z.enum(["login", "signup"]),
  name: z.string().trim().min(2).max(80).optional(),
  restaurantName: z.string().trim().min(2).max(100).optional(),
  city: z.string().trim().max(80).optional(),
  refCode: z.string().trim().max(40).optional(),
  portal: z.enum(["restaurant_admin", "super_admin"]).optional(),
});

const firebaseSigningKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export async function POST(req: Request) {
  try {
    if (!rateLimit(`firebase-auth:${clientIp(req)}`, 15, 900_000)) {
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Unable to validate the Google sign-in request." }, { status: 400 });
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.error("Firebase authentication is not configured: missing project ID.");
      return NextResponse.json({ error: "Google sign-in is not configured on this server." }, { status: 503 });
    }

    let payload;
    try {
      ({ payload } = await jwtVerify(parsed.data.idToken, firebaseSigningKeys, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      }));
    } catch (error) {
      console.warn("Firebase ID token validation failed:", error);
      return NextResponse.json({ error: "Google sign-in could not be verified. Please try again." }, { status: 401 });
    }
    const firebaseClaims = payload.firebase;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      payload.email_verified !== true ||
      !firebaseClaims ||
      typeof firebaseClaims !== "object" ||
      firebaseClaims.sign_in_provider !== "google.com"
    ) {
      return NextResponse.json({ error: "Use a verified Google account to continue." }, { status: 401 });
    }

    const email = payload.email.toLowerCase();
    let user = await db.user.findUnique({ where: { email } });

    if (parsed.data.mode === "signup") {
      if (parsed.data.portal || !parsed.data.name || !parsed.data.restaurantName) {
        return NextResponse.json({ error: "Enter your name and restaurant name to create an account." }, { status: 400 });
      }
      if (user) {
        return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
      }

      try {
        user = await db.user.create({
          data: {
            email,
            name: parsed.data.name,
            passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
            role: "restaurant_admin",
            restaurants: {
              create: {
                name: parsed.data.restaurantName,
                city: parsed.data.city || null,
                referredByName: parsed.data.refCode || null,
              },
            },
          },
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
        }
        throw error;
      }
    } else {
      if (!user) {
        return NextResponse.json({ error: "No account was found for this Google address. Create an account first." }, { status: 404 });
      }
      if (user.role !== "restaurant_admin") {
        return NextResponse.json({ error: "Google sign-in is available only for Restaurant Admin accounts." }, { status: 403 });
      }
      if (parsed.data.portal === "super_admin") {
        return NextResponse.json({ error: "Use your Super Admin email and password to sign in." }, { status: 403 });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unable to create or find your account." }, { status: 500 });
    }

    setSessionCookie(await createSessionToken({ uid: user.id, role: user.role }));
    return NextResponse.json({ ok: true, redirect: user.role === "super_admin" ? "/super-admin" : "/dashboard" });
  } catch (error) {
    console.error("Firebase authentication error:", error);
    return NextResponse.json({ error: "Server error during Google sign-in. Please try again." }, { status: 500 });
  }
}
