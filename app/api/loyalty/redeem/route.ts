import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId: reqRestaurantId,
      slug,
      rewardCode: rawCode,
    } = body;

    const rewardCode = (rawCode || "").trim().toUpperCase();
    if (!rewardCode) {
      return NextResponse.json({ error: "Reward voucher code is required" }, { status: 400 });
    }

    let restaurantId = reqRestaurantId;
    if (!restaurantId && slug) {
      const qr = await db.qrCode.findUnique({
        where: { slug },
        select: { restaurantId: true },
      });
      if (qr) restaurantId = qr.restaurantId;
    }

    const ownerCtx = await getOwnerContext();
    if (ownerCtx && !restaurantId) {
      restaurantId = ownerCtx.restaurant.id;
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant is required" }, { status: 400 });
    }

    const program = await getOrCreateLoyaltyProgram(restaurantId);

    const isOwner = ownerCtx?.restaurant.id === restaurantId;

    const reward = await db.loyaltyReward.findUnique({
      where: { code: rewardCode },
      include: {
        customer: true,
      },
    });

    if (!reward || reward.programId !== program.id) {
      return NextResponse.json({ error: "Invalid voucher code for this restaurant" }, { status: 404 });
    }

    if (reward.status === "REDEEMED") {
      const redeemedOn = reward.redeemedAt
        ? new Date(reward.redeemedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "earlier";
      return NextResponse.json(
        { error: `This voucher was already redeemed on ${redeemedOn}` },
        { status: 409 }
      );
    }

    if (reward.status === "EXPIRED" || new Date(reward.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "This reward voucher has expired" },
        { status: 400 }
      );
    }

    // Atomic redemption update
    const updatedReward = await db.loyaltyReward.update({
      where: { id: reward.id },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedByStaff: isOwner ? "Owner Dashboard" : "Counter Claim",
      },
    });

    const discountRs = updatedReward.discountAmount / 100;

    return NextResponse.json({
      success: true,
      message: `🎉 Successfully redeemed voucher ${rewardCode}! Applied ₹${discountRs} discount.`,
      reward: updatedReward,
      discountAmountRupees: discountRs,
      customer: {
        phone: reward.customer.phone,
        name: reward.customer.name,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to redeem voucher" },
      { status: 500 }
    );
  }
}
