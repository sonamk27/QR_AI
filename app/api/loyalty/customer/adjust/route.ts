import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram, normalizePhone } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phone: rawPhone, action, amount, reason } = body;

    const phone = normalizePhone(rawPhone || "");
    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: "Valid 10-digit phone number is required" }, { status: 400 });
    }

    const program = await getOrCreateLoyaltyProgram(ownerCtx.restaurant.id);

    let customer = await db.loyaltyCustomer.findUnique({
      where: {
        programId_phone: {
          programId: program.id,
          phone,
        },
      },
      include: {
        rewards: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!customer) {
      if (action === "lookup") {
        return NextResponse.json({ found: false, message: "No customer account found with this phone number." });
      }
      customer = await db.loyaltyCustomer.create({
        data: {
          programId: program.id,
          phone,
          currentStamps: 0,
          lifetimeStamps: 0,
        },
        include: { rewards: true },
      });
    }

    if (action === "lookup") {
      return NextResponse.json({
        found: true,
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.name,
          currentStamps: customer.currentStamps,
          lifetimeStamps: customer.lifetimeStamps,
          rewards: customer.rewards,
        },
      });
    }

    if (action === "grant_offer") {
      const { generateRewardCode } = await import("@/lib/loyalty");
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (program.rewardExpiryDays || 30));

      const newReward = await db.loyaltyReward.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          code: generateRewardCode("OFFER"),
          rewardTitle: program.rewardTitle,
          discountAmount: program.rewardDiscount,
          status: "UNREDEEMED",
          expiresAt: expiry,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Issued dynamic offer voucher ${newReward.code} to ${phone}`,
        reward: newReward,
      });
    }

    // Action: adjust
    const stampDiff = Number(amount) || 0;
    const newCurrentStamps = Math.max(0, customer.currentStamps + stampDiff);
    const newLifetime = stampDiff > 0 ? customer.lifetimeStamps + stampDiff : customer.lifetimeStamps;

    const [updatedCustomer, tx] = await db.$transaction([
      db.loyaltyCustomer.update({
        where: { id: customer.id },
        data: {
          currentStamps: newCurrentStamps,
          lifetimeStamps: newLifetime,
        },
      }),
      db.loyaltyTransaction.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: stampDiff,
          staffNote: `Admin Manual Adjustment: ${reason || "No reason specified"}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Updated ${phone}: ${customer.currentStamps} → ${updatedCustomer.currentStamps} stamps.`,
      customer: updatedCustomer,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to adjust stamps" },
      { status: 500 }
    );
  }
}
