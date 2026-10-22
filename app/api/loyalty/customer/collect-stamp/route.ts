import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram, normalizePhone, generateRewardCode } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, phone: rawPhone, name: rawName } = body;

    const phone = normalizePhone(rawPhone || "");
    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { error: "A valid 10-digit mobile number is required" },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json({ error: "Restaurant QR slug is required" }, { status: 400 });
    }

    const qr = await db.qrCode.findUnique({
      where: { slug },
      include: { restaurant: true },
    });

    if (!qr || qr.restaurant.status !== "ACTIVE") {
      return NextResponse.json({ error: "Restaurant not found or inactive" }, { status: 404 });
    }

    const program = await getOrCreateLoyaltyProgram(qr.restaurantId);
    if (!program.isActive) {
      return NextResponse.json({ error: "Loyalty program is currently paused" }, { status: 400 });
    }

    // Check if customer already collected a stamp in the last 2 minutes (rapid double-tap guard)
    const recentTx = await db.loyaltyTransaction.findFirst({
      where: {
        programId: program.id,
        customer: { phone },
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      },
      include: {
        customer: {
          include: {
            rewards: { orderBy: { createdAt: "desc" } },
            transactions: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        },
      },
    });

    if (recentTx && recentTx.customer) {
      return NextResponse.json({
        success: true,
        alreadyCollected: true,
        message: "You already collected your stamp for this visit! Here is your updated loyalty card.",
        customer: {
          id: recentTx.customer.id,
          name: recentTx.customer.name,
          phone: recentTx.customer.phone,
          currentStamps: recentTx.customer.currentStamps,
          lifetimeStamps: recentTx.customer.lifetimeStamps,
          rewards: recentTx.customer.rewards,
          transactions: recentTx.customer.transactions,
        },
        program,
      });
    }

    // Award 1 stamp in an atomic transaction
    const result = await db.$transaction(async (tx) => {
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
            name: (rawName || "").trim() || null,
            currentStamps: 0,
            lifetimeStamps: 0,
          },
        });
      } else if (rawName && !customer.name) {
        customer = await tx.loyaltyCustomer.update({
          where: { id: customer.id },
          data: { name: rawName.trim() },
        });
      }

      const nextLifetime = customer.lifetimeStamps + 1;
      let finalStamps =
        customer.currentStamps >= program.stampsRequired
          ? 1
          : customer.currentStamps + 1;
      const targetReached = finalStamps === program.stampsRequired;

      let newReward = null;
      if (targetReached) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (program.rewardExpiryDays || 30));

        newReward = await tx.loyaltyReward.create({
          data: {
            programId: program.id,
            customerId: customer.id,
            code: generateRewardCode("OFFER"),
            rewardTitle: program.rewardTitle,
            discountAmount: program.rewardDiscount,
            status: "UNREDEEMED",
            expiresAt: expiryDate,
          },
        });
      }

      const uniqueRef = `VISIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const transaction = await tx.loyaltyTransaction.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: 1,
          billAmount: program.minBillAmount,
          billReference: uniqueRef,
          staffNote: "Diner QR Visit Stamp",
        },
      });

      const updatedCustomer = await tx.loyaltyCustomer.update({
        where: { id: customer.id },
        data: {
          currentStamps: finalStamps,
          lifetimeStamps: nextLifetime,
          lastVisitAt: new Date(),
        },
        include: {
          rewards: { orderBy: { createdAt: "desc" } },
          transactions: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });

      return {
        customer: updatedCustomer,
        transaction,
        newReward,
        targetReached,
      };
    });

    // Calculate cycleNumber from redeemed rewards
    const redeemedCount = result.customer.rewards.filter((r: { status: string }) => r.status === "REDEEMED").length;
    const cycleNumber = redeemedCount + 1;

    const response = NextResponse.json({
      success: true,
      stampAwarded: true,
      targetReached: result.targetReached,
      newReward: result.newReward,
      message: result.targetReached
        ? `🎉 Congratulations! You reached ${program.stampsRequired} stamps and unlocked a reward: ${result.newReward?.rewardTitle}!`
        : `🎉 1 Stamp added! You now have ${result.customer.currentStamps} of ${program.stampsRequired} stamps.`,
      customer: {
        id: result.customer.id,
        name: result.customer.name,
        phone: result.customer.phone,
        currentStamps: result.customer.currentStamps,
        lifetimeStamps: result.customer.lifetimeStamps,
        cycleNumber,
        lastVisitAt: result.customer.lastVisitAt ?? null,
        rewards: result.customer.rewards,
        transactions: result.customer.transactions,
      },
      program,
    });

    response.cookies.set(`loyalty_phone_${slug}`, phone, {
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("[loyalty/customer/collect-stamp] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to collect stamp" },
      { status: 500 }
    );
  }
}
