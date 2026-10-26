import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram, generateRewardCode } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid stamp request is required." }, { status: 400 });
    }
    const { requestId, staffNote } = body;

    if (typeof requestId !== "string" || !requestId.trim()) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }
    if (typeof staffNote !== "undefined" && (typeof staffNote !== "string" || staffNote.length > 500)) {
      return NextResponse.json({ error: "Staff note must be 500 characters or fewer." }, { status: 400 });
    }

    const restaurantId = ctx.restaurant.id;
    const program = await getOrCreateLoyaltyProgram(restaurantId);

    const result = await db.$transaction(async (tx) => {
      const requestLock = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM stamp_requests
        WHERE id = ${requestId} AND restaurant_id = ${restaurantId}
        FOR UPDATE
      `;
      if (!requestLock.length) throw new Error("Stamp request not found");

      const stampReq = await tx.stampRequest.findFirst({
        where: {
          id: requestId,
          restaurantId,
        },
      });

      if (!stampReq) {
        throw new Error("Stamp request not found");
      }

      if (stampReq.status === "APPROVED") {
        return { alreadyApproved: true, stampReq };
      }

      if (stampReq.status === "REJECTED") {
        throw new Error("This stamp request was already rejected");
      }

      const stampsToAdd = stampReq.stampsAwarded || 1;
      const noteText = staffNote || `Approved by ${ctx.user.name}`;

      // ── ANONYMOUS CUSTOMER FLOW ──────────────────────────────────────────
      if (stampReq.anonCustomerId) {
        let anonCustomer = await tx.anonymousCustomer.findUnique({
          where: { id: stampReq.anonCustomerId },
        });

        if (!anonCustomer) {
          throw new Error("Anonymous customer not found");
        }

        await tx.$queryRaw`
          SELECT id FROM anonymous_customers WHERE id = ${anonCustomer.id} FOR UPDATE
        `;
        anonCustomer = await tx.anonymousCustomer.findUniqueOrThrow({ where: { id: anonCustomer.id } });

        // Duplicate stamp guard for anonymous diner (24-hour rolling window)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const existingTodayAnonTx = await tx.anonymousStampTransaction.findFirst({
          where: {
            customerId: anonCustomer.id,
            amount: { gt: 0 },
            createdAt: { gte: twentyFourHoursAgo },
          },
        });

        if (existingTodayAnonTx) {
          const updatedReq = await tx.stampRequest.update({
            where: { id: stampReq.id },
            data: {
              status: "APPROVED",
              reviewedAt: new Date(),
              reviewedById: ctx.user.id,
              staffNote: "Already stamped for this visit",
            },
          });

          return {
            alreadyApproved: true,
            customer: anonCustomer,
            stampReq: updatedReq,
            targetReached: false,
            isAnon: true,
          };
        }

        const nextLifetime = anonCustomer.lifetimeStamps + stampsToAdd;
        const finalStamps =
          anonCustomer.currentStamps >= program.stampsRequired
            ? 1
            : anonCustomer.currentStamps + stampsToAdd;
        const targetReached = finalStamps === program.stampsRequired;

        let newReward = null;
        if (targetReached) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (program.rewardExpiryDays || 30));

          newReward = await tx.anonymousReward.create({
            data: {
              customerId: anonCustomer.id,
              programId: program.id,
              code: generateRewardCode("OFFER"),
              rewardTitle: program.rewardTitle,
              discountAmount: program.rewardDiscount,
              status: "UNREDEEMED",
              idempotencyKey: `reward_approval_${stampReq.id}`,
              expiresAt: expiryDate,
            },
          });
        }

        // Create an anonymous visit record for traceability
        const visit = await tx.anonymousVisit.create({
          data: {
            customerId: anonCustomer.id,
            restaurantId,
            verificationRef: `approval_${stampReq.id}`,
            verifiedByStaffId: ctx.user.id,
          },
        });

        // Record the stamp transaction
        await tx.anonymousStampTransaction.create({
          data: {
            customerId: anonCustomer.id,
            visitId: visit.id,
            amount: stampsToAdd,
            type: "ISSUE",
            staffNote: noteText,
          },
        });

        const updatedAnonCustomer = await tx.anonymousCustomer.update({
          where: { id: anonCustomer.id },
          data: {
            currentStamps: finalStamps,
            lifetimeStamps: nextLifetime,
            lastVisitAt: new Date(),
          },
        });

        const updatedReq = await tx.stampRequest.update({
          where: { id: stampReq.id },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedById: ctx.user.id,
            staffNote: noteText,
          },
        });

        return {
          alreadyApproved: false,
          customer: updatedAnonCustomer,
          stampReq: updatedReq,
          newReward,
          targetReached,
          isAnon: true,
        };
      }

      // ── PHONE-BASED CUSTOMER FLOW ─────────────────────────────────────────
      if (!stampReq.customerPhone) {
        throw new Error("Cannot approve stamp request: customer phone is required for phone-based loyalty");
      }

      let customer = await tx.loyaltyCustomer.findUnique({
        where: {
          programId_phone: {
            programId: program.id,
            phone: stampReq.customerPhone,
          },
        },
      });

      if (!customer) {
        customer = await tx.loyaltyCustomer.create({
          data: {
            programId: program.id,
            phone: stampReq.customerPhone,
            name: stampReq.customerName || null,
            currentStamps: 0,
            lifetimeStamps: 0,
          },
        });
      } else if (stampReq.customerName && !customer.name) {
        customer = await tx.loyaltyCustomer.update({
          where: { id: customer.id },
          data: { name: stampReq.customerName },
        });
      }

      await tx.$queryRaw`
        SELECT id FROM loyalty_customers WHERE id = ${customer.id} FOR UPDATE
      `;
      customer = await tx.loyaltyCustomer.findUniqueOrThrow({ where: { id: customer.id } });

      // ── DUPLICATE STAMP GUARD: Check if already awarded a stamp in last 24 hours ──
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const existingTodayTx = await tx.loyaltyTransaction.findFirst({
        where: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: { gt: 0 },
          createdAt: { gte: twentyFourHoursAgo },
        },
      });

      if (existingTodayTx) {
        const updatedReq = await tx.stampRequest.update({
          where: { id: stampReq.id },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedById: ctx.user.id,
            staffNote: "Already stamped within last 24 hours",
          },
        });

        return {
          alreadyApproved: true,
          customer,
          stampReq: updatedReq,
          targetReached: false,
          isAnon: false,
        };
      }

      const nextLifetime = customer.lifetimeStamps + stampsToAdd;
      let finalStamps =
        customer.currentStamps >= program.stampsRequired
          ? 1
          : customer.currentStamps + stampsToAdd;

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

      const uniqueRef =
        stampReq.tableNo
          ? `${stampReq.tableNo}`
          : `VISIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      await tx.loyaltyTransaction.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: stampsToAdd,
          billAmount: program.minBillAmount,
          billReference: uniqueRef,
          staffNote: noteText,
        },
      });

      const updatedCustomer = await tx.loyaltyCustomer.update({
        where: { id: customer.id },
        data: {
          currentStamps: finalStamps,
          lifetimeStamps: nextLifetime,
          lastVisitAt: new Date(),
        },
      });

      const updatedReq = await tx.stampRequest.update({
        where: { id: stampReq.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: ctx.user.id,
          staffNote: noteText,
        },
      });

      return {
        alreadyApproved: false,
        customer: updatedCustomer,
        stampReq: updatedReq,
        newReward,
        targetReached,
        isAnon: false,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.alreadyApproved
        ? "This stamp request was already approved"
        : `1 Stamp approved for ${result.stampReq.customerName || "customer"}!`,
      targetReached: result.targetReached,
      newReward: result.newReward,
      currentStamps: result.customer?.currentStamps,
      isAnon: result.isAnon,
    });
  } catch (error: any) {
    console.error("[loyalty/requests/approve] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to approve stamp request" },
      { status: 500 }
    );
  }
}
