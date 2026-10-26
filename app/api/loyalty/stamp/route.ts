import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram, normalizePhone, generateRewardCode, getStampCycleDays, isStampCycleExpired } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json({ error: "Sign in as the restaurant owner to issue a stamp." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid stamp request is required." }, { status: 400 });
    }
    const {
      restaurantId: reqRestaurantId,
      slug,
      phone: rawPhone,
      customerName,
      billAmountRupees,
      billReference,
    } = body;

    const phone = normalizePhone(typeof rawPhone === "string" ? rawPhone : "");
    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: "A valid 10-digit mobile number is required" }, { status: 400 });
    }

    const restaurantId = ownerCtx.restaurant.id;
    if (reqRestaurantId && reqRestaurantId !== restaurantId) {
      return NextResponse.json({ error: "You can only issue stamps for your own restaurant." }, { status: 403 });
    }
    if (slug) {
      const ownedQr = await db.qrCode.findFirst({
        where: { slug: String(slug), restaurantId },
        select: { id: true },
      });
      if (!ownedQr) {
        return NextResponse.json({ error: "QR code not found for your restaurant." }, { status: 404 });
      }
    }

    const program = await getOrCreateLoyaltyProgram(restaurantId);
    if (!program.isActive) {
      return NextResponse.json({ error: "Loyalty program is currently paused" }, { status: 400 });
    }

    const cycleDays = getStampCycleDays(program);

    const minRs = program.minBillAmount / 100;
    const defaultBill = Math.max(minRs, 100);
    const rawBill = Number(billAmountRupees);
    const billAmount = Number.isFinite(rawBill) && rawBill > 0 ? rawBill : defaultBill;
    if (billAmount > 1_000_000 || !Number.isSafeInteger(Math.round(billAmount * 100))) {
      return NextResponse.json({ error: "Bill amount is out of range." }, { status: 400 });
    }
    const billAmountPaise = Math.round(billAmount * 100);

    const normalizedRef = (typeof billReference === "string" ? billReference.trim().slice(0, 120) : "") ||
      `STAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
              name: (typeof customerName === "string" ? customerName.trim().slice(0, 80) : "") || null,
              currentStamps: 0,
              lifetimeStamps: 0,
            },
          });
        } else if (typeof customerName === "string" && customerName.trim() && !customer.name) {
          customer = await tx.loyaltyCustomer.update({
            where: { id: customer.id },
            data: { name: customerName.trim().slice(0, 80) },
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
        const now = new Date();

        // ── Stamp Cycle Expiry Check ──
        // If the 30-day cycle has expired OR card was previously completed, reset stamps.
        const cycleExpired = isStampCycleExpired(freshCustomer.stampCycleStartedAt, cycleDays);
        const cardCompleted = freshCustomer.currentStamps >= program.stampsRequired;

        let stampsBase = freshCustomer.currentStamps;
        let newCycleNumber = freshCustomer.cycleNumber ?? 1;
        let newCycleStartedAt: Date | null = freshCustomer.stampCycleStartedAt;

        if (cycleExpired || cardCompleted) {
          // Start a fresh cycle
          stampsBase = 0;
          newCycleNumber = (freshCustomer.cycleNumber ?? 1) + 1;
          newCycleStartedAt = now;
        } else if (!freshCustomer.stampCycleStartedAt) {
          // First stamp ever — start the cycle clock now
          newCycleStartedAt = now;
        }

        const finalStamps = stampsBase + 1;
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
            cycleNumber: newCycleNumber,
            stampCycleStartedAt: newCycleStartedAt,
            lastVisitAt: now,
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
            staffNote: "Owner Award",
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
