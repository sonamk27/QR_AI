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

    const body = await req.json();
    const { requestId, staffNote } = body;

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const restaurantId = ctx.restaurant.id;
    const program = await getOrCreateLoyaltyProgram(restaurantId);

    const result = await db.$transaction(async (tx) => {
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

      // Find or create customer
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

      const stampsToAdd = stampReq.stampsAwarded || 1;
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
        stampReq.tableNo ? `${stampReq.tableNo}` : `VISIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      await tx.loyaltyTransaction.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: stampsToAdd,
          billAmount: program.minBillAmount,
          billReference: uniqueRef,
          staffNote: staffNote || `Owner Approved (${ctx.user.name})`,
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
          staffNote: staffNote || `Approved by ${ctx.user.name}`,
        },
      });

      return {
        alreadyApproved: false,
        customer: updatedCustomer,
        stampReq: updatedReq,
        newReward,
        targetReached,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.alreadyApproved
        ? "This stamp request was already approved"
        : `1 Stamp approved for ${result.stampReq.customerName || result.stampReq.customerPhone}!`,
      targetReached: result.targetReached,
      newReward: result.newReward,
      currentStamps: result.customer?.currentStamps,
    });
  } catch (error: any) {
    console.error("[loyalty/requests/approve] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to approve stamp request" },
      { status: 500 }
    );
  }
}
