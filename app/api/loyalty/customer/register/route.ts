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

    if (!customer) {
      customer = await db.loyaltyCustomer.create({
        data: {
          programId: program.id,
          phone,
          name,
          currentStamps: 0,
          lifetimeStamps: 0,
          lastVisitAt: new Date(),
        },
        include: {
          rewards: true,
          transactions: true,
        },
      });
    } else if (name && customer.name !== name) {
      customer = await db.loyaltyCustomer.update({
        where: { id: customer.id },
        data: {
          name,
          lastVisitAt: new Date(),
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
    }

    const response = NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        currentStamps: customer.currentStamps,
        lifetimeStamps: customer.lifetimeStamps,
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
