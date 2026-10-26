import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurantId = ownerCtx.restaurant.id;
    const program = await getOrCreateLoyaltyProgram(restaurantId);

    // Aggregate statistics
    const [totalCustomers, totalTransactions, unredeemedRewards, redeemedRewards] = await Promise.all([
      db.loyaltyCustomer.count({
        where: { programId: program.id },
      }),
      db.loyaltyTransaction.count({
        where: { programId: program.id },
      }),
      db.loyaltyReward.count({
        where: { programId: program.id, status: "UNREDEEMED" },
      }),
      db.loyaltyReward.count({
        where: { programId: program.id, status: "REDEEMED" },
      }),
    ]);

    // Fetch 15 most recent stamp transactions with customer info
    const recentActivity = await db.loyaltyTransaction.findMany({
      where: { programId: program.id },
      include: {
        customer: {
          select: { phone: true, name: true, currentStamps: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return NextResponse.json({
      program,
      stats: {
        totalCustomers,
        totalTransactions,
        unredeemedRewards,
        redeemedRewards,
      },
      recentActivity,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load loyalty settings" },
      { status: 500 }
    );
  }
}

const settingsSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  discountType: z.enum(["PERCENT", "FLAT", "FREE_ITEM"]).optional(),
  stampsRequired: z.number().int().min(1).max(20).optional(),
  minBillAmountRupees: z.number().finite().min(0).max(1_000_000).optional(),
  rewardTitle: z.string().trim().min(1).max(120).optional(),
  rewardDiscountRupees: z.number().finite().min(0).max(50_000).optional(),
  rewardExpiryDays: z.number().int().min(1).max(365).optional(),
  terminalPin: z.string().trim().max(32).optional(),
}).strict().refine((body) => Object.keys(body).length > 0, "At least one setting is required.");

async function updateSettings(req: NextRequest) {
  try {
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurantId = ownerCtx.restaurant.id;
    const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the loyalty settings and try again." }, { status: 400 });
    }
    const body = parsed.data;

    const program = await getOrCreateLoyaltyProgram(restaurantId);

    // Determine the effective discount type (use sent value or fall back to existing)
    const effectiveDiscountType = body.discountType;

    // Determine discount value — interpretation depends on the type that will be saved
    const resolvedType = effectiveDiscountType ?? program.discountType ?? "PERCENT";
    let rewardDiscountData: number | undefined = undefined;
    if (body.rewardDiscountRupees !== undefined) {
      const rawVal = Number(body.rewardDiscountRupees);
      if (isNaN(rawVal) || rawVal < 0) {
        return NextResponse.json({ error: "Discount value must be a valid number" }, { status: 400 });
      }
      if (resolvedType === "PERCENT") {
        if (rawVal < 1 || rawVal > 100) {
          return NextResponse.json({ error: "Percentage discount must be between 1 and 100." }, { status: 400 });
        }
        rewardDiscountData = Math.round(rawVal);
      } else if (resolvedType === "FREE_ITEM") {
        rewardDiscountData = 0;
      } else {
        // Flat: convert rupees to paise
        rewardDiscountData = Math.round(rawVal * 100);
      }
    }

    // Validate minBillAmount
    let minBillData: number | undefined;
    if (body.minBillAmountRupees !== undefined) {
      minBillData = Math.round(body.minBillAmountRupees * 100);
    }

    const updated = await db.loyaltyProgram.update({
      where: { id: program.id },
      data: {
        title: body.title !== undefined ? String(body.title).trim() : undefined,
        isActive: body.isActive,
        discountType: effectiveDiscountType,
        stampsRequired: body.stampsRequired,
        minBillAmount: minBillData,
        rewardTitle: body.rewardTitle !== undefined ? String(body.rewardTitle).trim() : undefined,
        rewardDiscount: rewardDiscountData,
        rewardExpiryDays: body.rewardExpiryDays,
        terminalPin:
          body.terminalPin !== undefined
            ? String(body.terminalPin).trim() || null
            : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      program: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update loyalty settings" },
      { status: 500 }
    );
  }
}

// Keep POST as a compatibility alias for clients that still have the older settings form cached.
export async function PATCH(req: NextRequest) {
  return updateSettings(req);
}

export async function POST(req: NextRequest) {
  return updateSettings(req);
}
