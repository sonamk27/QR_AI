import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram, generateRewardCode } from "@/lib/loyalty";
import { getAnonCustomerLoyaltyCard } from "@/lib/anon-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // ── 1. STAFF AUTHENTICATION GUARD ──
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json(
        { error: "Unauthorized. Staff authorization required to issue stamps." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      customerId: rawCustomerId,
      visitRef: rawVisitRef,
      restaurantId: reqRestaurantId,
      staffNote,
    } = body;

    const customerId = (rawCustomerId || "").trim();
    const visitRef = (rawVisitRef || "").trim();

    if (!customerId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    if (!visitRef) {
      return NextResponse.json(
        { error: "A unique verification visit reference (e.g., invoice/receipt #) is required" },
        { status: 400 }
      );
    }

    // Tenant isolation: staff can only operate on their own restaurant
    const restaurantId = ownerCtx.restaurant.id;
    if (reqRestaurantId && reqRestaurantId !== restaurantId) {
      return NextResponse.json(
        { error: "Forbidden: You cannot issue stamps for another restaurant" },
        { status: 403 }
      );
    }

    const program = await getOrCreateLoyaltyProgram(restaurantId);
    if (!program.isActive) {
      return NextResponse.json({ error: "Loyalty program is currently paused" }, { status: 400 });
    }

    // ── 2. DUPLICATE VISIT GUARD (Fast-path pre-check) ──
    const existingVisit = await db.anonymousVisit.findUnique({
      where: { verificationRef: visitRef },
    });

    if (existingVisit) {
      return NextResponse.json(
        {
          error: `Visit reference "${visitRef}" has already been verified and stamped. Each visit reference must be unique.`,
        },
        { status: 409 }
      );
    }

    // ── 3. ATOMIC TRANSACTION WITH ROW-LEVEL LOCK ──
    const result = await db.$transaction(
      async (tx) => {
        // Find customer and verify tenant isolation
        const customer = await tx.anonymousCustomer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        if (customer.restaurantId !== restaurantId) {
          throw new Error("CUSTOMER_RESTAURANT_MISMATCH");
        }

        if (customer.status !== "ACTIVE") {
          throw new Error("CUSTOMER_INACTIVE");
        }

        // Acquire row-level lock on the customer row to serialize concurrent requests
        await tx.$queryRaw`
          SELECT id FROM anonymous_customers WHERE id = ${customer.id} FOR UPDATE
        `;

        // Re-read fresh state under lock
        const freshCustomer = await tx.anonymousCustomer.findUniqueOrThrow({
          where: { id: customer.id },
        });

        // Create AnonymousVisit record
        const visit = await tx.anonymousVisit.create({
          data: {
            customerId: freshCustomer.id,
            restaurantId,
            verificationRef: visitRef,
            verifiedByStaffId: ownerCtx.user.id,
          },
        });

        const nextLifetime = freshCustomer.lifetimeStamps + 1;
        let finalStamps =
          freshCustomer.currentStamps >= program.stampsRequired
            ? 1
            : freshCustomer.currentStamps + 1;
        const targetReached = finalStamps === program.stampsRequired;

        let newReward = null;

        if (targetReached) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (program.rewardExpiryDays || 30));

          newReward = await tx.anonymousReward.create({
            data: {
              customerId: freshCustomer.id,
              programId: program.id,
              code: generateRewardCode("OFFER"),
              rewardTitle: program.rewardTitle,
              discountAmount: program.rewardDiscount,
              status: "UNREDEEMED",
              idempotencyKey: `reward_${visitRef}`,
              expiresAt: expiryDate,
            },
          });
        }

        const updatedCustomer = await tx.anonymousCustomer.update({
          where: { id: freshCustomer.id },
          data: {
            currentStamps: finalStamps,
            lifetimeStamps: nextLifetime,
            lastVisitAt: new Date(),
          },
        });

        // Record stamp transaction
        const transaction = await tx.anonymousStampTransaction.create({
          data: {
            customerId: freshCustomer.id,
            visitId: visit.id,
            amount: 1,
            type: "ISSUE",
            staffNote: staffNote?.trim() || `Staff: ${ownerCtx.user.name || ownerCtx.user.email}`,
          },
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            restaurantId,
            actorId: ownerCtx.user.id,
            action: "ANON_LOYALTY_STAMP_AWARD",
            target: customer.id,
            meta: {
              visitRef,
              visitId: visit.id,
              currentStamps: finalStamps,
              targetReached,
              rewardId: newReward?.id || null,
            },
          },
        });

        return {
          customer: updatedCustomer,
          visit,
          transaction,
          newReward,
          targetReached,
        };
      },
      {
        isolationLevel: "RepeatableRead",
      }
    );

    // Retrieve fresh full card state
    const cardData = await getAnonCustomerLoyaltyCard(restaurantId, result.customer.id);

    return NextResponse.json({
      success: true,
      message: result.targetReached
        ? `🎉 1 Stamp awarded! Customer reached ${program.stampsRequired} stamps and unlocked a reward: ${result.newReward?.rewardTitle}!`
        : `✅ 1 Stamp awarded! Customer now has ${result.customer.currentStamps}/${program.stampsRequired} stamps.`,
      customer: cardData.customer,
      program: cardData.program,
      newReward: result.newReward,
      targetReached: result.targetReached,
      visit: result.visit,
    });
  } catch (error: any) {
    if (error?.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Anonymous customer account not found" }, { status: 404 });
    }
    if (error?.message === "CUSTOMER_RESTAURANT_MISMATCH") {
      return NextResponse.json(
        { error: "Customer does not belong to this restaurant" },
        { status: 403 }
      );
    }
    if (error?.message === "CUSTOMER_INACTIVE") {
      return NextResponse.json(
        { error: "This customer account is suspended or inactive" },
        { status: 403 }
      );
    }
    // DB unique constraint error (P2002) on verificationRef
    if (error?.code === "P2002" && error?.meta?.target?.includes("verification_ref")) {
      return NextResponse.json(
        { error: "Verification reference has already been used for a visit" },
        { status: 409 }
      );
    }

    console.error("[loyalty/anon/stamp] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to issue stamp" },
      { status: 500 }
    );
  }
}
