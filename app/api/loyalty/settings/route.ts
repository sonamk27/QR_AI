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

    const updated = await db.loyaltyProgram.update({
      where: { id: program.id },
      data: {
        title: body.title !== undefined ? String(body.title).trim() : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        discountType: body.discountType === "PERCENT" ? "PERCENT" : "FLAT",
        stampsRequired: body.stampsRequired !== undefined ? Math.max(1, Math.min(20, Number(body.stampsRequired))) : undefined,
        minBillAmount: body.minBillAmountRupees !== undefined ? Math.round(Number(body.minBillAmountRupees) * 100) : undefined,
        rewardTitle: body.rewardTitle !== undefined ? String(body.rewardTitle).trim() : undefined,
        rewardDiscount: body.rewardDiscountRupees !== undefined 
          ? (body.discountType === "PERCENT" 
              ? Math.max(1, Math.min(100, Math.round(Number(body.rewardDiscountRupees)))) 
              : Math.round(Number(body.rewardDiscountRupees) * 100))
          : undefined,
        rewardExpiryDays: body.rewardExpiryDays !== undefined ? Math.max(1, Number(body.rewardExpiryDays)) : undefined,
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
