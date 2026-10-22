import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";

export const COOKIE_NAME = "anon_session";
export const SESSION_EXPIRY_DAYS = 30;

// In-memory rate limiter for session creation: max 30 creations per IP per 10 minutes
const sessionCreations = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SESSIONS_PER_WINDOW = 30;

function checkSessionCreationRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const record = sessionCreations.get(clientIp);

  if (!record || record.resetAt <= now) {
    sessionCreations.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_SESSIONS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

/**
 * SHA-256 hash of an opaque token. Tokens are never stored raw in DB.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a cryptographically secure random opaque token.
 */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generates an anonymous customer identifier (e.g. anon_k8jF3m9PqR).
 */
export function generateAnonCustomerId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(16);
  let str = "";
  for (let i = 0; i < 16; i++) {
    str += chars[bytes[i] % chars.length];
  }
  return `anon_${str}`;
}

/**
 * Creates a new AnonymousCustomer and AnonymousSession for the restaurant.
 * Returns the customer record and the raw opaque token (to be sent via cookie).
 */
export async function createAnonSession(restaurantId: string) {
  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const customerId = generateAnonCustomerId();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  const result = await db.$transaction(async (tx) => {
    const customer = await tx.anonymousCustomer.create({
      data: {
        id: customerId,
        restaurantId,
        status: "ACTIVE",
        currentStamps: 0,
        lifetimeStamps: 0,
      },
    });

    const session = await tx.anonymousSession.create({
      data: {
        tokenHash,
        customerId: customer.id,
        expiresAt,
      },
    });

    return { customer, session };
  });

  return {
    customerId: result.customer.id,
    customer: result.customer,
    session: result.session,
    token: rawToken,
  };
}

/**
 * Sets the HttpOnly, Secure, SameSite=Lax session cookie on the response.
 */
export function setAnonSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  });
}

/**
 * Clears the anonymous session cookie.
 */
export function clearAnonSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Reads the anon_session cookie, hashes it, and looks up the active session.
 * If valid and belongs to the given restaurant, returns existing customer.
 * If missing, invalid, or expired, creates a new session and returns the raw token to set in cookie.
 */
export async function getOrCreateAnonSession(req: NextRequest, restaurantId: string) {
  const rawToken = req.cookies.get(COOKIE_NAME)?.value;

  if (rawToken && typeof rawToken === "string" && rawToken.trim()) {
    const tokenHash = hashToken(rawToken.trim());
    const now = new Date();

    const existingSession = await db.anonymousSession.findUnique({
      where: { tokenHash },
      include: {
        customer: true,
      },
    });

    if (
      existingSession &&
      !existingSession.revokedAt &&
      existingSession.expiresAt > now &&
      existingSession.customer &&
      existingSession.customer.restaurantId === restaurantId &&
      existingSession.customer.status === "ACTIVE"
    ) {
      return {
        customerId: existingSession.customerId,
        customer: existingSession.customer,
        isNew: false,
        token: null,
      };
    }
  }

  // Rate limiting check for new session creation
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!checkSessionCreationRateLimit(clientIp)) {
    throw new Error("Too many session creation requests. Please try again later.");
  }

  // Create new anonymous identity and session
  const newSession = await createAnonSession(restaurantId);

  return {
    customerId: newSession.customerId,
    customer: newSession.customer,
    isNew: true,
    token: newSession.token,
  };
}

/**
 * Fetches the complete anonymous customer loyalty card for display.
 */
export async function getAnonCustomerLoyaltyCard(restaurantId: string, customerId: string) {
  const program = await getOrCreateLoyaltyProgram(restaurantId);

  const customer = await db.anonymousCustomer.findUnique({
    where: { id: customerId },
    include: {
      rewards: {
        where: { programId: program.id },
        orderBy: { createdAt: "desc" },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!customer || customer.restaurantId !== restaurantId) {
    throw new Error("Anonymous customer not found for this restaurant");
  }

  const redeemedCount = customer.rewards.filter((r) => r.status === "REDEEMED").length;
  const cycleNumber = redeemedCount + 1;

  return {
    program: {
      id: program.id,
      title: program.title,
      discountType: program.discountType || "FLAT",
      stampsRequired: program.stampsRequired,
      minBillAmount: program.minBillAmount,
      rewardTitle: program.rewardTitle,
      rewardDiscount: program.rewardDiscount,
      rewardExpiryDays: program.rewardExpiryDays,
      isActive: program.isActive,
    },
    customer: {
      id: customer.id,
      status: customer.status,
      currentStamps: customer.currentStamps,
      lifetimeStamps: customer.lifetimeStamps,
      cycleNumber,
      lastVisitAt: customer.lastVisitAt,
      rewards: customer.rewards,
      transactions: customer.transactions,
    },
  };
}
