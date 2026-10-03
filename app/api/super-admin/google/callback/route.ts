import { timingSafeEqual } from "crypto";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSuperAdmin } from "@/lib/auth";
import {
  encryptGoogleToken,
  exchangeGoogleAuthorizationCode,
  googleOAuthSigningKey,
} from "@/lib/google-business-profile";
import { db } from "@/lib/db";
import { appBaseUrl } from "@/lib/qr";

function restaurantsUrl(result: string) {
  const url = new URL("/super-admin/restaurants", appBaseUrl());
  url.searchParams.set("google", result);
  return url;
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set("google_business_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const stateCookie = cookies().get("google_business_oauth_state")?.value;

  if (oauthError) {
    return clearStateCookie(NextResponse.redirect(restaurantsUrl("access_denied")));
  }
  if (!state || !stateCookie || !code) {
    return clearStateCookie(NextResponse.redirect(restaurantsUrl("invalid_state")));
  }

  const received = Buffer.from(state);
  const expected = Buffer.from(stateCookie);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return clearStateCookie(NextResponse.redirect(restaurantsUrl("invalid_state")));
  }

  try {
    const { payload } = await jwtVerify(state, googleOAuthSigningKey(), {
      issuer: "reviewflow",
      audience: "reviewflow-google-business",
    });
    const admin = await getSuperAdmin();
    if (
      !admin ||
      payload.uid !== admin.id ||
      typeof payload.restaurantId !== "string" ||
      typeof payload.nonce !== "string"
    ) {
      return clearStateCookie(NextResponse.redirect(restaurantsUrl("invalid_state")));
    }

    const restaurant = await db.restaurant.findUnique({
      where: { id: payload.restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      return clearStateCookie(NextResponse.redirect(restaurantsUrl("restaurant_not_found")));
    }

    const refreshToken = await exchangeGoogleAuthorizationCode(code);
    await db.$transaction([
      db.googleBusinessConnection.upsert({
        where: { restaurantId: restaurant.id },
        create: {
          restaurantId: restaurant.id,
          encryptedRefreshToken: encryptGoogleToken(refreshToken),
        },
        update: {
          encryptedRefreshToken: encryptGoogleToken(refreshToken),
          locationName: null,
          locationTitle: null,
        },
      }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.google_connected",
          target: restaurant.id,
          restaurantId: restaurant.id,
        },
      }),
    ]);

    return clearStateCookie(NextResponse.redirect(restaurantsUrl("connected")));
  } catch (error) {
    console.error("Google Business Profile OAuth callback failed:", error);
    return clearStateCookie(NextResponse.redirect(restaurantsUrl("authorization_failed")));
  }
}
