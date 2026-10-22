import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram, normalizePhone, generateRewardCode } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phone: rawQuery, customerId: reqCustomerId, action, amount, reason } = body;

    const query = String(rawQuery || reqCustomerId || "").trim();
    if (!query) {
      return NextResponse.json(
        { error: "Anonymous Customer ID or phone number is required" },
        { status: 400 }
      );
    }

    const restaurantId = ownerCtx.restaurant.id;
    const program = await getOrCreateLoyaltyProgram(restaurantId);

    // ── 1. CHECK IF QUERY IS ANONYMOUS CUSTOMER ID ──
    const isAnonQuery = query.startsWith("anon_") || query.length > 15;
    let anonCustomer = null;

    if (isAnonQuery || query.length >= 10) {
      anonCustomer = await db.anonymousCustomer.findFirst({
        where: {
          id: query,
          restaurantId,
        },
        include: {
          rewards: {
            where: { programId: program.id },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    if (anonCustomer) {
      if (action === "lookup") {
        return NextResponse.json({
          found: true,
          isAnonymous: true,
          customer: {
            id: anonCustomer.id,
            anonymousId: anonCustomer.id,
            phone: null,
            name: "Anonymous Diner",
            currentStamps: anonCustomer.currentStamps,
            lifetimeStamps: anonCustomer.lifetimeStamps,
            rewards: anonCustomer.rewards,
          },
        });
      }

      if (action === "grant_offer") {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + (program.rewardExpiryDays || 30));

        const newReward = await db.anonymousReward.create({
          data: {
            programId: program.id,
            customerId: anonCustomer.id,
            code: generateRewardCode("OFFER"),
            rewardTitle: program.rewardTitle,
            discountAmount: program.rewardDiscount,
            status: "UNREDEEMED",
            expiresAt: expiry,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Issued dynamic offer voucher ${newReward.code} to anonymous diner (${anonCustomer.id})`,
          reward: newReward,
        });
      }

      // Action: adjust
      const stampDiff = Number(amount) || 0;
      const newCurrentStamps = Math.max(0, anonCustomer.currentStamps + stampDiff);
      const newLifetime = stampDiff > 0 ? anonCustomer.lifetimeStamps + stampDiff : anonCustomer.lifetimeStamps;

      const [updatedCustomer, tx] = await db.$transaction([
        db.anonymousCustomer.update({
          where: { id: anonCustomer.id },
          data: {
            currentStamps: newCurrentStamps,
            lifetimeStamps: newLifetime,
          },
        }),
        db.anonymousStampTransaction.create({
          data: {
            customerId: anonCustomer.id,
            amount: stampDiff,
            type: stampDiff >= 0 ? "ISSUE" : "REVERSE",
            staffNote: `Staff Adjustment: ${reason || "Manual adjustment"}`,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Updated anonymous diner ${anonCustomer.id}: ${anonCustomer.currentStamps} → ${updatedCustomer.currentStamps} stamps.`,
        customer: {
          id: updatedCustomer.id,
          anonymousId: updatedCustomer.id,
          phone: null,
          name: "Anonymous Diner",
          currentStamps: updatedCustomer.currentStamps,
          lifetimeStamps: updatedCustomer.lifetimeStamps,
        },
      });
    }

    // ── 2. PHONE-BASED CUSTOMER FALLBACK ──
    const phone = normalizePhone(query);
    if (!phone || phone.length < 10) {
      if (action === "lookup") {
        return NextResponse.json({
          found: false,
          message: `No customer account found matching "${query}". Check the Anonymous ID or 10-digit number.`,
        });
      }
      return NextResponse.json(
        { error: "Valid 10-digit phone number or anonymous ID required" },
        { status: 400 }
      );
    }

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
        return NextResponse.json({
          found: false,
          message: "No customer account found with this phone number.",
        });
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
        isAnonymous: false,
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

    const [updatedCustomer] = await db.$transaction([
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
    console.error("[loyalty/customer/adjust] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to adjust customer" },
      { status: 500 }
    );
  }
}
