import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // ── 1. STAFF AUTHENTICATION GUARD ──
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json(
        { error: "Unauthorized. Staff authorization required to redeem rewards." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { rewardId: rawRewardId, idempotencyKey: rawIdempotencyKey } = body;

    const rewardId = (rawRewardId || "").trim();
    const idempotencyKey = (rawIdempotencyKey || "").trim();

    if (!rewardId) {
      return NextResponse.json({ error: "Reward ID is required" }, { status: 400 });
    }

    if (!idempotencyKey) {
      return NextResponse.json({ error: "Idempotency key is required" }, { status: 400 });
    }

    const restaurantId = ownerCtx.restaurant.id;

    // ── 2. IDEMPOTENCY PRE-CHECK ──
    const existingRedemption = await db.anonymousRedemption.findUnique({
      where: { idempotencyKey },
      include: {
        reward: true,
      },
    });

    if (existingRedemption) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: "Reward has already been redeemed (idempotent request).",
        redemption: existingRedemption,
        reward: existingRedemption.reward,
      });
    }

    // ── 3. ATOMIC ROW-LOCK REDEMPTION ──
    const result = await db.$transaction(
      async (tx) => {
        // Lock the reward row
        const lockedRows = await tx.$queryRaw<
          Array<{
            id: string;
            customerId: string;
            programId: string;
            status: string;
            expiresAt: Date;
            rewardTitle: string;
            discountAmount: number;
            code: string;
          }>
        >`
          SELECT id, customer_id as "customerId", program_id as "programId", status, expires_at as "expiresAt",
                 reward_title as "rewardTitle", discount_amount as "discountAmount", code
          FROM anonymous_rewards
          WHERE id = ${rewardId}
          FOR UPDATE
        `;

        const reward = lockedRows[0];
        if (!reward) {
          throw new Error("REWARD_NOT_FOUND");
        }

        // Verify program belongs to staff's restaurant
        const program = await tx.loyaltyProgram.findUnique({
          where: { id: reward.programId },
        });

        if (!program || program.restaurantId !== restaurantId) {
          throw new Error("REWARD_RESTAURANT_MISMATCH");
        }

        if (reward.status === "REDEEMED") {
          throw new Error("REWARD_ALREADY_REDEEMED");
        }

        if (reward.status === "EXPIRED" || new Date(reward.expiresAt) < new Date()) {
          throw new Error("REWARD_EXPIRED");
        }

        // Update reward status
        const updatedReward = await tx.anonymousReward.update({
          where: { id: reward.id },
          data: {
            status: "REDEEMED",
            redeemedAt: new Date(),
          },
        });

        // Create redemption record with unique idempotencyKey
        const redemption = await tx.anonymousRedemption.create({
          data: {
            rewardId: reward.id,
            staffId: ownerCtx.user.id,
            status: "COMPLETED",
            idempotencyKey,
          },
        });

        // Reset current customer stamps to 0 for next card cycle
        await tx.anonymousCustomer.update({
          where: { id: reward.customerId },
          data: {
            currentStamps: 0,
            lastVisitAt: new Date(),
          },
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            restaurantId,
            actorId: ownerCtx.user.id,
            action: "ANON_LOYALTY_REWARD_REDEEM",
            target: reward.customerId,
            meta: {
              rewardId: reward.id,
              code: reward.code,
              idempotencyKey,
              discountAmount: reward.discountAmount,
            },
          },
        });

        return {
          reward: updatedReward,
          redemption,
        };
      },
      {
        isolationLevel: "RepeatableRead",
      }
    );

    return NextResponse.json({
      success: true,
      message: `🎉 Reward voucher ${result.reward.code} successfully redeemed!`,
      redemption: result.redemption,
      reward: result.reward,
    });
  } catch (error: any) {
    if (error?.message === "REWARD_NOT_FOUND") {
      return NextResponse.json({ error: "Reward voucher not found" }, { status: 404 });
    }
    if (error?.message === "REWARD_RESTAURANT_MISMATCH") {
      return NextResponse.json(
        { error: "Reward does not belong to this restaurant" },
        { status: 403 }
      );
    }
    if (error?.message === "REWARD_ALREADY_REDEEMED") {
      return NextResponse.json(
        { error: "This reward has already been redeemed" },
        { status: 409 }
      );
    }
    if (error?.message === "REWARD_EXPIRED") {
      return NextResponse.json(
        { error: "This reward has expired and can no longer be redeemed" },
        { status: 400 }
      );
    }
    if (error?.code === "P2002" && error?.meta?.target?.includes("idempotency_key")) {
      return NextResponse.json(
        { error: "This redemption action with the provided idempotency key has already been processed" },
        { status: 409 }
      );
    }

    console.error("[loyalty/anon/redeem] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to redeem reward" },
      { status: 500 }
    );
  }
}
