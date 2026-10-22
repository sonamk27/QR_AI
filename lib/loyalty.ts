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

export async function getCustomerLoyaltyCard(restaurantId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone || phone.length < 10) {
    throw new Error("Invalid 10-digit mobile number");
  }

  const program = await getOrCreateLoyaltyProgram(restaurantId);

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
      },
      include: {
        rewards: true,
        transactions: true,
      },
    });
  }

  // Vouchers are only issued by the stamp API when stamps reach the required count.
  // No auto-issuance here — customers must earn stamps to unlock rewards.

  // Calculate the completed stamp cycles (how many times they've earned a reward)
  const redeemedCount = customer.rewards.filter((r) => r.status === "REDEEMED").length;
  const cycleNumber = redeemedCount + 1; // current cycle they are in

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
    },
    customer: {
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      currentStamps: customer.currentStamps,
      lifetimeStamps: customer.lifetimeStamps,
      cycleNumber,
      lastVisitAt: customer.lastVisitAt,
      rewards: customer.rewards,
      transactions: customer.transactions,
    },
  };
}
