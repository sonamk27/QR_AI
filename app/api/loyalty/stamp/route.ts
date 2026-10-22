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

    const minRs = program.minBillAmount / 100;
    const defaultBill = Math.max(minRs, 100);
    const rawBill = Number(billAmountRupees);
    const billAmount = !isNaN(rawBill) && rawBill > 0 ? rawBill : defaultBill;
    const billAmountPaise = Math.round(billAmount * 100);

    const normalizedRef = billReference?.trim() || `STAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // ── APP-LEVEL PRE-CHECK (fast path before acquiring DB lock) ──
    const recentTx = await db.loyaltyTransaction.findFirst({
      where: {
        programId: program.id,
        customer: { phone },
        billAmount: billAmountPaise,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    // ── ATOMIC STAMP UPDATE with row-level customer lock ──
    const result = await db.$transaction(
      async (tx) => {
        // ── 1. Find or create customer, then LOCK the row ──
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

        await tx.$queryRaw`
          SELECT id FROM "loyalty_customers" WHERE id = ${customer.id} FOR UPDATE
        `;

        // Re-read fresh stamp count after acquiring the lock
        const freshCustomer = await tx.loyaltyCustomer.findUniqueOrThrow({
          where: { id: customer.id },
        });

        const nextLifetime = freshCustomer.lifetimeStamps + 1;

        // If customer previously completed a full card (>= stampsRequired), start new card cycle
        let finalStamps =
          freshCustomer.currentStamps >= program.stampsRequired
            ? 1
            : freshCustomer.currentStamps + 1;
        const targetReached = finalStamps === program.stampsRequired;

        let newReward = null;

        if (targetReached) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (program.rewardExpiryDays || 30));

          newReward = await tx.loyaltyReward.create({
            data: {
              programId: program.id,
              customerId: freshCustomer.id,
              code: generateRewardCode("OFFER"),
              rewardTitle: program.rewardTitle,
              discountAmount: program.rewardDiscount,
              status: "UNREDEEMED",
              expiresAt: expiryDate,
            },
          });
        }

        const updatedCustomer = await tx.loyaltyCustomer.update({
          where: { id: freshCustomer.id },
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

        // ── 2. Insert transaction — DB unique index enforces billReference uniqueness ──
        // If normalizedRef is not null and was already used, Postgres throws a unique
        // constraint violation (P2002), which we handle in the outer catch.
        const transaction = await tx.loyaltyTransaction.create({
          data: {
            programId: program.id,
            customerId: freshCustomer.id,
            stampsCount: 1,
            billAmount: billAmountPaise,
            billReference: normalizedRef,
            staffNote: isOwner ? "Owner Award" : "Direct Visit Award",
          },
        });

        return {
          customer: updatedCustomer,
          transaction,
          newReward,
          targetReached,
        };
      },
      {
        // Use REPEATABLE READ isolation so that both the stamp read and the write see
        // a consistent snapshot within the transaction. Combined with the FOR UPDATE
        // lock this eliminates phantom read issues on the stamp count.
        isolationLevel: "RepeatableRead",
      }
    );

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
    // Prisma unique constraint violation — P2002 — means the billReference was already used.
    // The DB-level unique index (loyalty_tx_unique_bill_ref) caught it even if the
    // app-level check was bypassed by a concurrent request.
    if (error?.code === "P2002" && error?.meta?.target?.includes("loyalty_tx_unique_bill_ref")) {
      return NextResponse.json(
        {
          error: `Bill reference "${(error.meta as any)?.billReference || "provided"}" has already been recorded. Each invoice reference must be unique per customer.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to award stamp" },
      { status: 500 }
    );
  }
}
