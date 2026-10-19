import { db } from "@/lib/db";

export function formatPaiseToRupees(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function generateRewardCode(prefix = "RWD"): string {
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
        title: "Coffee & Dining Rewards",
        isActive: true,
        stampsRequired: 10,
        minBillAmount: 20000, // ₹200.00
        rewardTitle: "₹100 Off Your Bill",
        rewardDiscount: 10000, // ₹100.00
        rewardExpiryDays: 30,
        terminalPin: "1234",
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
        take: 10,
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

  return {
    program: {
      id: program.id,
      title: program.title,
      stampsRequired: program.stampsRequired,
      minBillAmount: program.minBillAmount,
      rewardTitle: program.rewardTitle,
      rewardDiscount: program.rewardDiscount,
      rewardExpiryDays: program.rewardExpiryDays,
    },
    customer: {
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      currentStamps: customer.currentStamps,
      lifetimeStamps: customer.lifetimeStamps,
      lastVisitAt: customer.lastVisitAt,
      rewards: customer.rewards,
      transactions: customer.transactions,
    },
  };
}
