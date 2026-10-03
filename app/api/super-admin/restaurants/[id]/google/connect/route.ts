import { randomBytes } from "crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { getSuperAdmin } from "@/lib/auth";
import { createGoogleAuthorizationUrl, googleOAuthSigningKey } from "@/lib/google-business-profile";
import { db } from "@/lib/db";
import { appBaseUrl } from "@/lib/qr";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const restaurant = await db.restaurant.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });

  try {
    const nonce = randomBytes(32).toString("base64url");
    const state = await new SignJWT({
      uid: admin.id,
      restaurantId: restaurant.id,
      nonce,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("reviewflow")
      .setAudience("reviewflow-google-business")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(googleOAuthSigningKey());

    const response = NextResponse.redirect(createGoogleAuthorizationUrl(state));
    response.cookies.set("google_business_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("Unable to start Google Business Profile OAuth:", error);
    return NextResponse.redirect(
      new URL("/super-admin/restaurants?google=setup_required", appBaseUrl()),
    );
  }
}
