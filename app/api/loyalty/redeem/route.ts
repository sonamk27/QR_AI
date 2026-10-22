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
      billAmountRupees,
    } = body;

    const rewardCode = (rawCode || "").trim().toUpperCase();
    if (!rewardCode) {
      return NextResponse.json({ error: "Reward voucher code is required" }, { status: 400 });
    }

    // ── SECURITY: Only authenticated restaurant owners may redeem vouchers ──
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json(
        { error: "Unauthorized. Only the restaurant owner can redeem vouchers." },
        { status: 401 }
      );
    }

    let restaurantId = reqRestaurantId;
    if (!restaurantId && slug) {
      const qr = await db.qrCode.findUnique({
        where: { slug },
        select: { restaurantId: true },
      });
      if (qr) restaurantId = qr.restaurantId;
    }

    // Default to the owner's own restaurant if not specified
    if (!restaurantId) {
      restaurantId = ownerCtx.restaurant.id;
    }

    // Ensure the owner can only redeem for their own restaurant
    if (restaurantId !== ownerCtx.restaurant.id) {
      return NextResponse.json(
        { error: "You can only redeem vouchers for your own restaurant." },
        { status: 403 }
      );
    }

    const program = await getOrCreateLoyaltyProgram(restaurantId);

    // ── BILL AMOUNT VALIDATION (before entering the transaction) ──
    let billPaise: number | null = null;
    if (billAmountRupees !== undefined && billAmountRupees !== null && billAmountRupees !== "") {
      const parsedBill = Number(billAmountRupees);
      if (isNaN(parsedBill) || parsedBill < 0) {
        return NextResponse.json({ error: "Please provide a valid bill amount" }, { status: 400 });
      }
      if (parsedBill === 0) {
        return NextResponse.json({ error: "Bill amount cannot be zero for redemption" }, { status: 400 });
      }

      billPaise = Math.round(parsedBill * 100);

      // Verify minimum spend rule configured by owner
      if (billPaise < program.minBillAmount) {
        const minRs = program.minBillAmount / 100;
        return NextResponse.json(
          {
            error: `Bill amount ₹${parsedBill} is below the qualifying minimum of ₹${minRs} required for this offer.`,
            minBillAmountRupees: minRs,
          },
          { status: 400 }
        );
      }
    }

    // ── ATOMIC REDEMPTION with row-level lock + REPEATABLE READ isolation ──
    // REPEATABLE READ ensures the status check and update see the same snapshot.
    // SELECT FOR UPDATE acquires a write lock on the row so concurrent requests queue;
    // the second request will read status = "REDEEMED" set by the first and fail cleanly.
    const result = await db.$transaction(
      async (tx) => {
      // Lock the specific reward row to prevent race conditions
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          programId: string;
          customerId: string;
          status: string;
          expiresAt: Date;
          redeemedAt: Date | null;
          discountAmount: number;
          rewardTitle: string;
          code: string;
        }>
      >`
        SELECT id, "programId", "customerId", status, "expiresAt", "redeemedAt",
               "discountAmount", "rewardTitle", code
        FROM loyalty_rewards
        WHERE code = ${rewardCode}
        FOR UPDATE
      `;

      let isAnonymous = false;
      let reward = locked[0];

      if (!reward) {
        const lockedAnon = await tx.$queryRaw<
          Array<{
            id: string;
            programId: string;
            customerId: string;
            status: string;
            expiresAt: Date;
            redeemedAt: Date | null;
            discountAmount: number;
            rewardTitle: string;
            code: string;
          }>
        >`
          SELECT id, program_id as "programId", customer_id as "customerId", status, expires_at as "expiresAt",
                 redeemed_at as "redeemedAt", discount_amount as "discountAmount", reward_title as "rewardTitle", code
          FROM anonymous_rewards
          WHERE code = ${rewardCode}
          FOR UPDATE
        `;

        if (lockedAnon[0]) {
          reward = lockedAnon[0];
          isAnonymous = true;
        }
      }

      if (!reward || reward.programId !== program.id) {
        throw new Error("REWARD_NOT_FOUND");
      }
      if (reward.status === "REDEEMED") {
        throw new Error("REWARD_ALREADY_REDEEMED");
      }
      if (reward.status === "EXPIRED" || new Date(reward.expiresAt) < new Date()) {
        throw new Error("REWARD_EXPIRED");
      }

      // Dynamic discount calculation (inside lock for consistency)
      let discountPaise = reward.discountAmount;
      if (billPaise !== null) {
        if (program.discountType === "PERCENT") {
          discountPaise = Math.round((billPaise * reward.discountAmount) / 100);
        } else {
          // Flat — cannot exceed the bill
          discountPaise = Math.min(billPaise, reward.discountAmount);
        }
      }

      const payablePaise = billPaise !== null ? Math.max(0, billPaise - discountPaise) : null;

      if (isAnonymous) {
        const updatedReward = await tx.anonymousReward.update({
          where: { id: reward.id },
          data: {
            status: "REDEEMED",
            redeemedAt: new Date(),
          },
        });

        const redemption = await tx.anonymousRedemption.create({
          data: {
            rewardId: reward.id,
            staffId: ownerCtx.user.id,
            status: "COMPLETED",
            idempotencyKey: `redeem_${reward.id}_${Date.now()}`,
          },
        });

        await tx.anonymousCustomer.update({
          where: { id: reward.customerId },
          data: { lastVisitAt: new Date(), currentStamps: 0 },
        });

        await tx.anonymousStampTransaction.create({
          data: {
            customerId: reward.customerId,
            amount: 0,
            type: "ISSUE",
            staffNote: `Offer Redeemed: ${rewardCode}${discountPaise ? ` (Discount: ₹${(discountPaise / 100).toFixed(0)})` : ""}`,
          },
        });

        await tx.auditLog.create({
          data: {
            restaurantId,
            actorId: ownerCtx.user.id,
            action: "ANON_LOYALTY_REWARD_REDEEM",
            target: reward.customerId,
            meta: { rewardId: reward.id, code: reward.code, discountPaise },
          },
        });

        return {
          reward: updatedReward,
          customer: {
            phone: `Anonymous (${reward.customerId.slice(0, 10)}…)`,
            name: "Anonymous Diner",
          },
          discountPaise,
          payablePaise,
        };
      }

      // Fetch phone-based customer for activity update
      const customer = await tx.loyaltyCustomer.findUnique({
        where: { id: reward.customerId },
        select: { id: true, phone: true, name: true, lifetimeStamps: true },
      });
      if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

      const updatedReward = await tx.loyaltyReward.update({
        where: { id: reward.id },
        data: {
          status: "REDEEMED",
          redeemedAt: new Date(),
          redeemedByStaff: `Owner: ${ownerCtx.user.name || ownerCtx.user.email}`,
        },
      });

      // Log the redemption as a transaction (stampsCount = 0 — it's a redemption, not a stamp)
      const transaction = await tx.loyaltyTransaction.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: 0,
          billAmount: billPaise,
          staffNote: `Offer Redeemed: ${rewardCode}${discountPaise ? ` (Discount: ₹${(discountPaise / 100).toFixed(0)})` : ""}`,
        },
      });

      // Reset stamp count to 0 so the customer portal shows a fresh initial stamp card
      // for the next earning cycle after this reward is redeemed.
      await tx.loyaltyCustomer.update({
        where: { id: customer.id },
        data: { lastVisitAt: new Date(), currentStamps: 0 },
      });

      return {
        reward: updatedReward,
        transaction,
        customer,
        discountPaise,
        payablePaise,
      };
    });

    const discountRs = result.discountPaise / 100;
    const billRs = billPaise ? billPaise / 100 : null;
    const payableRs = result.payablePaise !== null ? result.payablePaise / 100 : null;

    return NextResponse.json({
      success: true,
      message: `🎉 Voucher ${rewardCode} redeemed! Applied ₹${discountRs.toFixed(0)} discount.`,
      reward: result.reward,
      discountAmountRupees: discountRs,
      billAmountRupees: billRs,
      netPayableRupees: payableRs,
      customer: {
        phone: result.customer.phone,
        name: result.customer.name,
      },
    });
  } catch (error: any) {
    const msg = error?.message || "";
    if (msg === "REWARD_NOT_FOUND") {
      return NextResponse.json({ error: "Invalid voucher code for this restaurant" }, { status: 404 });
    }
    if (msg === "REWARD_ALREADY_REDEEMED") {
      return NextResponse.json({ error: "This voucher has already been redeemed" }, { status: 409 });
    }
    if (msg === "REWARD_EXPIRED") {
      return NextResponse.json({ error: "This reward voucher has expired" }, { status: 400 });
    }
    if (msg === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Customer record not found" }, { status: 404 });
    }
    console.error("[loyalty/redeem] error:", error);
    return NextResponse.json(
      { error: "Failed to redeem voucher" },
      { status: 500 }
    );
  }
}
