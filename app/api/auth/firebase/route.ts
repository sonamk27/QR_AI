import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { isSupportedLogo, MAX_LOGO_DATA_URL_LENGTH } from "@/lib/logo-url";

const schema = z.object({
  idToken: z.string().min(1).max(10_000),
  mode: z.enum(["login", "signup"]),
  name: z.string().trim().min(2).max(80).optional(),
  restaurantName: z.string().trim().min(2).max(100).optional(),
  city: z.string().trim().max(80).optional(),
  logoUrl: z.string().trim().max(MAX_LOGO_DATA_URL_LENGTH).optional().nullable().or(z.literal(""))
    .refine((logo) => !logo || isSupportedLogo(logo), "Use a secure logo image URL or upload a supported image."),
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
    if (!parsed.success) return NextResponse.json({ error: "Unable to validate the Firebase sign-in request." }, { status: 400 });

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return NextResponse.json({ error: "Firebase Authentication is not configured on this server." }, { status: 503 });

    let payload;
    try {
      ({ payload } = await jwtVerify(parsed.data.idToken, firebaseSigningKeys, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      }));
    } catch {
      return NextResponse.json({ error: "Firebase could not verify your sign-in. Please try again." }, { status: 401 });
    }

    const claims = payload.firebase;
    const provider = claims && typeof claims === "object" ? claims.sign_in_provider : null;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" ||
        !["google.com", "password"].includes(String(provider))) {
      return NextResponse.json({ error: "Use Google or email and password to continue." }, { status: 401 });
    }
    const email = payload.email.toLowerCase();
    let user = await db.user.findUnique({ where: { email } });

    if (parsed.data.mode === "signup") {
      if (parsed.data.portal || !parsed.data.name || !parsed.data.restaurantName) {
        return NextResponse.json({ error: "Enter your name and business name to create an account." }, { status: 400 });
      }
      if (!user) {
        user = await db.user.create({
          data: {
            email,
            name: parsed.data.name,
            passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
            role: "restaurant_admin",
            restaurants: { create: {
              name: parsed.data.restaurantName,
              city: parsed.data.city || null,
              logoUrl: parsed.data.logoUrl || null,
              referredByName: parsed.data.refCode || null,
            } },
          },
        });
      } else if (user.role !== "restaurant_admin") {
        return NextResponse.json({ error: "This email belongs to a provisioned administrator account. Sign in instead." }, { status: 409 });
      }
    } else {
      if (!user) return NextResponse.json({ error: "No account was found for this email. Create an account first." }, { status: 404 });
      if (parsed.data.portal && user.role !== parsed.data.portal) {
        return NextResponse.json({ error: user.role === "super_admin"
          ? "This account is for the Super Admin portal."
          : "This account is for the Restaurant Admin portal." }, { status: 403 });
      }
    }

    if (!user) return NextResponse.json({ error: "Unable to create or find your account." }, { status: 500 });
    await setSessionCookie(await createSessionToken({ uid: user.id, role: user.role }));
    return NextResponse.json({ ok: true, redirect: user.role === "super_admin" ? "/super-admin" : "/dashboard" });
  } catch (error) {
    console.error("Firebase authentication error:", error);
    return NextResponse.json({ error: "Server error during Firebase sign-in. Please try again." }, { status: 500 });
  }
}
