import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram, normalizePhone, generateRewardCode } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId: reqRestaurantId,
      slug,
      phone: rawPhone,
      customerName,
      billAmountRupees,
      billReference,
    } = body;

    const phone = normalizePhone(rawPhone || "");
    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: "A valid 10-digit mobile number is required" }, { status: 400 });
    }

    let restaurantId = reqRestaurantId;
    if (!restaurantId && slug) {
      const qr = await db.qrCode.findUnique({
        where: { slug },
        select: { restaurantId: true },
      });
      if (qr) restaurantId = qr.restaurantId;
    }

    // Check owner session
    const ownerCtx = await getOwnerContext();
    if (ownerCtx && !restaurantId) {
      restaurantId = ownerCtx.restaurant.id;
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant is required" }, { status: 400 });
    }

    const program = await getOrCreateLoyaltyProgram(restaurantId);
    if (!program.isActive) {
      return NextResponse.json({ error: "Loyalty program is currently paused" }, { status: 400 });
    }

    const isOwner = ownerCtx?.restaurant.id === restaurantId;

    const billAmount = Number(billAmountRupees);
    if (isNaN(billAmount) || billAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid bill amount" }, { status: 400 });
    }

    const billAmountPaise = Math.round(billAmount * 100);
    if (billAmountPaise < program.minBillAmount) {
      const minRs = program.minBillAmount / 100;
      return NextResponse.json(
        { error: `Bill amount ₹${billAmount} is below the qualifying minimum of ₹${minRs}` },
        { status: 400 }
      );
    }

    // Check anti-fraud duplicate within 5 minutes for the exact same customer & bill amount
    const recentTx = await db.loyaltyTransaction.findFirst({
      where: {
        programId: program.id,
        customer: { phone },
        billAmount: billAmountPaise,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    if (recentTx && !billReference) {
      return NextResponse.json(
        { error: "A stamp was already awarded for this bill amount in the last 5 minutes. Enter an invoice/bill reference to override." },
        { status: 409 }
      );
    }

    // Execute atomic stamp update & reward creation
    const result = await db.$transaction(async (tx) => {
      // Find or create customer
      let customer = await tx.loyaltyCustomer.findUnique({
        where: {
          programId_phone: {
            programId: program.id,
            phone,
          },
        },
      });

      if (!customer) {
        customer = await tx.loyaltyCustomer.create({
          data: {
            programId: program.id,
            phone,
            name: customerName?.trim() || null,
            currentStamps: 0,
            lifetimeStamps: 0,
          },
        });
      } else if (customerName && !customer.name) {
        customer = await tx.loyaltyCustomer.update({
          where: { id: customer.id },
          data: { name: customerName.trim() },
        });
      }

      const nextLifetime = customer.lifetimeStamps + 1;
      
      // If customer previously completed a full card (>= stampsRequired), start new card cycle with 1 stamp
      let finalStamps = customer.currentStamps >= program.stampsRequired ? 1 : customer.currentStamps + 1;
      const targetReached = finalStamps === program.stampsRequired;

      let newReward = null;

      if (targetReached) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (program.rewardExpiryDays || 30));

        newReward = await tx.loyaltyReward.create({
          data: {
            programId: program.id,
            customerId: customer.id,
            code: generateRewardCode(),
            rewardTitle: program.rewardTitle,
            discountAmount: program.rewardDiscount,
            status: "UNREDEEMED",
            expiresAt: expiryDate,
          },
        });
      }

      const updatedCustomer = await tx.loyaltyCustomer.update({
        where: { id: customer.id },
        data: {
          currentStamps: finalStamps,
          lifetimeStamps: nextLifetime,
          lastVisitAt: new Date(),
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: 1,
          billAmount: billAmountPaise,
          billReference: billReference?.trim() || null,
          staffNote: isOwner ? "Owner Award" : "Staff Terminal",
        },
      });

      return {
        customer: updatedCustomer,
        transaction,
        newReward,
        targetReached,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.targetReached
        ? `1 Stamp awarded! Customer reached ${program.stampsRequired} stamps and unlocked a reward: ${result.newReward?.rewardTitle}!`
        : `1 Stamp awarded! Customer now has ${result.customer.currentStamps}/${program.stampsRequired} stamps.`,
      customer: result.customer,
      newReward: result.newReward,
      targetReached: result.targetReached,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to award stamp" },
      { status: 500 }
    );
  }
}
