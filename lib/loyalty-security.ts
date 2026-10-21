import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";

type AttemptRecord = {
  count: number;
  lockedUntil?: number;
};

// Global in-memory rate-limiter for PIN attempts per IP/restaurant
// Survives across requests within node process
const terminalAttempts = new Map<string, AttemptRecord>();

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export type VerifyPinResult = {
  valid: boolean;
  isLocked?: boolean;
  minsRemaining?: number;
  attemptsRemaining?: number;
  isDefaultPin?: boolean;
  error?: string;
};

/**
 * Validates staff terminal PIN with brute-force protection
 */
export async function verifyTerminalPinWithRateLimit(
  restaurantId: string,
  providedPin: string,
  clientIp = "unknown"
): Promise<VerifyPinResult> {
  const rateLimitKey = `${clientIp}_${restaurantId}`;
  const now = Date.now();
  const tracker = terminalAttempts.get(rateLimitKey);

  // Check if currently locked out
  if (tracker?.lockedUntil && tracker.lockedUntil > now) {
    const minsRemaining = Math.max(1, Math.ceil((tracker.lockedUntil - now) / 60000));
    return {
      valid: false,
      isLocked: true,
      minsRemaining,
      error: `Too many failed attempts. Terminal is temporarily locked for ${minsRemaining} minute(s).`,
    };
  }

  const program = await getOrCreateLoyaltyProgram(restaurantId);
  const cleanPin = String(providedPin || "").trim();
  const expectedPin = String(program.terminalPin || "1234").trim();

  if (!cleanPin || cleanPin !== expectedPin) {
    const nextCount = (tracker?.count || 0) + 1;
    if (nextCount >= MAX_PIN_ATTEMPTS) {
      terminalAttempts.set(rateLimitKey, {
        count: nextCount,
        lockedUntil: now + LOCKOUT_DURATION_MS,
      });
      return {
        valid: false,
        isLocked: true,
        minsRemaining: 15,
        error: "Too many incorrect PIN attempts. Terminal locked for 15 minutes.",
      };
    } else {
      terminalAttempts.set(rateLimitKey, { count: nextCount });
      const attemptsRemaining = MAX_PIN_ATTEMPTS - nextCount;
      return {
        valid: false,
        attemptsRemaining,
        error: `Incorrect staff PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before temporary lockout.`,
      };
    }
  }

  // Success - reset failed counter
  terminalAttempts.delete(rateLimitKey);

  return {
    valid: true,
    isDefaultPin: expectedPin === "1234",
  };
}
