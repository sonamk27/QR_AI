import { db } from "@/lib/db";

export function formatPaiseToRupees(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function generateRewardCode(prefix = "OFFER"): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const char = chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${random}${char}`;
}

/**
 * Normalizes phone numbers (removes spaces, dashes, country code prefix if +91)
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length > 10 && cleaned.startsWith("91")) {
    return cleaned.slice(2);
  }
  return cleaned;
}

export async function getOrCreateLoyaltyProgram(restaurantId: string) {
  let program = await db.loyaltyProgram.findUnique({
    where: { restaurantId },
  });

  if (!program) {
    program = await db.loyaltyProgram.create({
      data: {
        restaurantId,
        title: "Special Dining Offer",
        isActive: true,
        discountType: "FLAT",
        stampsRequired: 1,
        minBillAmount: 50000, // ₹500.00
        rewardTitle: "Flat ₹100 Off on ₹500+ Bill",
        rewardDiscount: 10000, // ₹100.00
        rewardExpiryDays: 30,
      },
    });
  }

  return program;
}

/**
 * Returns the number of days for a stamp cycle.
 * Uses the program's rewardExpiryDays as the cycle period (default 30 days).
 */
export function getStampCycleDays(program: { rewardExpiryDays: number }): number {
  return program.rewardExpiryDays || 30;
}

/**
 * Checks if the customer's current stamp cycle has expired.
 * A cycle expires when (now - stampCycleStartedAt) > cycleDays.
 */
export function isStampCycleExpired(
  stampCycleStartedAt: Date | null,
  cycleDays: number
): boolean {
  if (!stampCycleStartedAt) return false; // no cycle started yet
  const cycleEndMs = stampCycleStartedAt.getTime() + cycleDays * 24 * 60 * 60 * 1000;
  return Date.now() > cycleEndMs;
}

export async function getCustomerLoyaltyCard(restaurantId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone || phone.length < 10) {
    throw new Error("Invalid 10-digit mobile number");
  }

  const program = await getOrCreateLoyaltyProgram(restaurantId);
  const cycleDays = getStampCycleDays(program);

  let customer = await db.loyaltyCustomer.findUnique({
    where: {
      programId_phone: {
        programId: program.id,
        phone,
      },
    },
    include: {
      rewards: {
        orderBy: { createdAt: "desc" },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!customer) {
    customer = await db.loyaltyCustomer.create({
      data: {
        programId: program.id,
        phone,
        currentStamps: 0,
        lifetimeStamps: 0,
        cycleNumber: 1,
        stampCycleStartedAt: null,
      },
      include: {
        rewards: true,
        transactions: true,
      },
    });
  }

  // ── Stamp Cycle Expiry: reset currentStamps if the 30-day cycle has expired ──
  if (
    customer.currentStamps > 0 &&
    isStampCycleExpired(customer.stampCycleStartedAt, cycleDays)
  ) {
    customer = await db.loyaltyCustomer.update({
      where: { id: customer.id },
      data: {
        currentStamps: 0,
        cycleNumber: { increment: 1 },
        stampCycleStartedAt: null, // will be set fresh on next stamp
      },
      include: {
        rewards: { orderBy: { createdAt: "desc" } },
        transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  }

  // Vouchers are only issued by the stamp API when stamps reach the required count.
  // No auto-issuance here — customers must earn stamps to unlock rewards.

  // Calculate the completed stamp cycles (how many times they've earned a reward)
  const redeemedCount = customer.rewards.filter((r) => r.status === "REDEEMED").length;
  const cycleNumber = customer.cycleNumber ?? (redeemedCount + 1);

  // Compute cycle expiry date for display on the card
  const cycleDaysMs = cycleDays * 24 * 60 * 60 * 1000;
  const cycleEndsAt = customer.stampCycleStartedAt
    ? new Date(customer.stampCycleStartedAt.getTime() + cycleDaysMs)
    : null;

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
      requireOwnerVerification: Boolean(program.terminalPin && program.terminalPin.trim() !== ""),
      stampCycleDays: cycleDays,
    },
    customer: {
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      currentStamps: customer.currentStamps,
      lifetimeStamps: customer.lifetimeStamps,
      cycleNumber,
      stampCycleStartedAt: customer.stampCycleStartedAt,
      cycleEndsAt,
      lastVisitAt: customer.lastVisitAt,
      rewards: customer.rewards,
      transactions: customer.transactions,
    },
  };
}
