import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram, normalizePhone } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, name: rawName, phone: rawPhone } = body;

    const phone = normalizePhone(rawPhone || "");
    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { error: "A valid 10-digit mobile number is required" },
        { status: 400 }
      );
    }

    const name = (rawName || "").trim() || "Valued Guest";

    if (!slug) {
      return NextResponse.json({ error: "Restaurant QR slug is required" }, { status: 400 });
    }

    const qr = await db.qrCode.findUnique({
      where: { slug },
      select: { restaurantId: true, restaurant: true },
    });

    if (!qr || qr.restaurant.status !== "ACTIVE") {
      return NextResponse.json({ error: "Restaurant not found or inactive" }, { status: 404 });
    }

    const program = await getOrCreateLoyaltyProgram(qr.restaurantId);

    // Find or create the customer (no OTP required)
    let customer = await db.loyaltyCustomer.findUnique({
      where: {
        programId_phone: {
          programId: program.id,
          phone,
        },
      },
      include: {
        rewards: {
          orderBy: { createdAt: "desc" },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    let stampAwarded = false;
    let targetReached = false;
    let newReward = null;

    if (!customer) {
      const initialStamps = 1;
      targetReached = initialStamps === program.stampsRequired;

      customer = await db.loyaltyCustomer.create({
        data: {
          programId: program.id,
          phone,
          name,
          currentStamps: initialStamps,
          lifetimeStamps: initialStamps,
          lastVisitAt: new Date(),
        },
        include: {
          rewards: true,
          transactions: true,
        },
      });

      stampAwarded = true;

      if (targetReached) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (program.rewardExpiryDays || 30));
        const { generateRewardCode } = await import("@/lib/loyalty");
        newReward = await db.loyaltyReward.create({
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
        customer.rewards = [newReward];
      }

      const uniqueRef = `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const txRecord = await db.loyaltyTransaction.create({
        data: {
          programId: program.id,
          customerId: customer.id,
          stampsCount: 1,
          billAmount: program.minBillAmount,
          billReference: uniqueRef,
          staffNote: "Welcome / 1st Visit Stamp",
        },
      });
      customer.transactions = [txRecord];
    } else {
      // Existing customer: check if they should receive a visit stamp (double-tap guard: 2 mins)
      const recentTx = await db.loyaltyTransaction.findFirst({
        where: {
          programId: program.id,
          customerId: customer.id,
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
        },
      });

      if (!recentTx) {
        const nextLifetime = customer.lifetimeStamps + 1;
        const finalStamps =
          customer.currentStamps >= program.stampsRequired
            ? 1
            : customer.currentStamps + 1;
        targetReached = finalStamps === program.stampsRequired;

        if (targetReached) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (program.rewardExpiryDays || 30));
          const { generateRewardCode } = await import("@/lib/loyalty");
          newReward = await db.loyaltyReward.create({
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
        await db.loyaltyTransaction.create({
          data: {
            programId: program.id,
            customerId: customer.id,
            stampsCount: 1,
            billAmount: program.minBillAmount,
            billReference: uniqueRef,
            staffNote: "QR Visit Stamp",
          },
        });

        customer = await db.loyaltyCustomer.update({
          where: { id: customer.id },
          data: {
            name: name || customer.name,
            currentStamps: finalStamps,
            lifetimeStamps: nextLifetime,
            lastVisitAt: new Date(),
          },
          include: {
            rewards: { orderBy: { createdAt: "desc" } },
            transactions: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        });
        stampAwarded = true;
      } else if (name && customer.name !== name) {
        customer = await db.loyaltyCustomer.update({
          where: { id: customer.id },
          data: { name, lastVisitAt: new Date() },
          include: {
            rewards: { orderBy: { createdAt: "desc" } },
            transactions: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        });
      }
    }

    const redeemedCount = customer.rewards.filter((r: { status: string }) => r.status === "REDEEMED").length;
    const cycleNumber = redeemedCount + 1;

    const response = NextResponse.json({
      success: true,
      stampAwarded,
      targetReached,
      newReward,
      message: stampAwarded
        ? `🎉 1 Stamp awarded! Customer now has ${customer.currentStamps}/${program.stampsRequired} stamps.`
        : "Welcome back! Here is your loyalty card.",
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        currentStamps: customer.currentStamps,
        lifetimeStamps: customer.lifetimeStamps,
        cycleNumber,
        lastVisitAt: customer.lastVisitAt ?? null,
        rewards: customer.rewards,
        transactions: customer.transactions,
      },
      program: {
        id: program.id,
        title: program.title,
        stampsRequired: program.stampsRequired,
        rewardTitle: program.rewardTitle,
        rewardDiscount: program.rewardDiscount,
        discountType: program.discountType,
        rewardExpiryDays: program.rewardExpiryDays,
        minBillAmount: program.minBillAmount,
      },
    });

    // Set secure cookie remembering the customer for this restaurant
    response.cookies.set(`loyalty_phone_${slug}`, phone, {
      path: "/",
      maxAge: 90 * 24 * 60 * 60, // 90 days
      httpOnly: false, // accessible to client for fast hydration
      sameSite: "lax",
    });

    response.cookies.set(`loyalty_name_${slug}`, encodeURIComponent(name), {
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("[loyalty/customer/register] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to register customer" },
      { status: 500 }
    );
  }
}
