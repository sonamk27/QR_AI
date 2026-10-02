import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { db } from "./db";

export type Session = { uid: string; role: Role };
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-secret-change-me");

export async function createSessionToken(s: Session) {
  return new SignJWT({ uid: s.uid, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(key());
}

export function setSessionCookie(token: string) {
  cookies().set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().set("session", "", { path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (
      typeof payload.uid !== "string" ||
      (payload.role !== "restaurant_admin" && payload.role !== "super_admin")
    ) {
      return null;
    }
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
}

/** Restaurant admin context: the logged-in user and their restaurant. */
export async function getOwnerContext() {
  const s = await getSession();
  if (!s || s.role !== "restaurant_admin") return null;
  const user = await db.user.findUnique({
    where: { id: s.uid },
    include: { restaurants: { take: 1 } },
  });
  const restaurant = user?.restaurants[0];
  if (!user || user.role !== "restaurant_admin" || !restaurant) return null;
  return { user, restaurant };
}

export async function getSuperAdmin() {
  const s = await getSession();
  if (!s || s.role !== "super_admin") return null;
  const user = await db.user.findUnique({ where: { id: s.uid } });
  return user?.role === "super_admin" ? user : null;
}
