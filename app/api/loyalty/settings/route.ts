import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";

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

export async function PATCH(req: NextRequest) {
  try {
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurantId = ownerCtx.restaurant.id;
    const body = await req.json();

    const program = await getOrCreateLoyaltyProgram(restaurantId);

    // Determine the effective discount type (use sent value or fall back to existing)
    const effectiveDiscountType: string | undefined =
      body.discountType !== undefined
        ? body.discountType === "PERCENT"
          ? "PERCENT"
          : "FLAT"
        : undefined;

    // Determine discount value — interpretation depends on the type that will be saved
    const resolvedType = effectiveDiscountType ?? program.discountType ?? "FLAT";
    let rewardDiscountData: number | undefined = undefined;
    if (body.rewardDiscountRupees !== undefined) {
      const rawVal = Number(body.rewardDiscountRupees);
      if (isNaN(rawVal) || rawVal <= 0) {
        return NextResponse.json({ error: "Discount value must be a positive number" }, { status: 400 });
      }
      if (resolvedType === "PERCENT") {
        // Percentage: store the raw % value (1–90)
        rewardDiscountData = Math.max(1, Math.min(90, Math.round(rawVal)));
      } else {
        // Flat: convert rupees to paise
        rewardDiscountData = Math.round(rawVal * 100);
      }
    }

    // Validate minBillAmount
    let minBillData: number | undefined = undefined;
    if (body.minBillAmountRupees !== undefined) {
      const minVal = Number(body.minBillAmountRupees);
      if (isNaN(minVal) || minVal < 0) {
        return NextResponse.json({ error: "Minimum bill amount must be a non-negative number" }, { status: 400 });
      }
      minBillData = Math.round(minVal * 100);
    }

    const updated = await db.loyaltyProgram.update({
      where: { id: program.id },
      data: {
        title: body.title !== undefined ? String(body.title).trim() : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        discountType: effectiveDiscountType,
        stampsRequired:
          body.stampsRequired !== undefined
            ? Math.max(1, Math.min(20, Number(body.stampsRequired)))
            : undefined,
        minBillAmount: minBillData,
        rewardTitle: body.rewardTitle !== undefined ? String(body.rewardTitle).trim() : undefined,
        rewardDiscount: rewardDiscountData,
        rewardExpiryDays:
          body.rewardExpiryDays !== undefined
            ? Math.max(1, Math.min(365, Number(body.rewardExpiryDays)))
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
