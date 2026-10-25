import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram, normalizePhone } from "@/lib/loyalty";

// Prisma client regenerated with StampRequest model
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, phone: rawPhone, name: rawName } = body;

    const phone = normalizePhone(rawPhone || "");
    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { error: "A valid 10-digit mobile number is required" },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json({ error: "Restaurant QR slug is required" }, { status: 400 });
    }

    const qr = await db.qrCode.findUnique({
      where: { slug },
      include: { restaurant: true },
    });

    if (!qr || qr.restaurant.status !== "ACTIVE") {
      return NextResponse.json({ error: "Restaurant not found or inactive" }, { status: 404 });
    }

    const program = await getOrCreateLoyaltyProgram(qr.restaurantId);
    if (!program.isActive) {
      return NextResponse.json({ error: "Loyalty program is currently paused" }, { status: 400 });
    }

    const trimmedName = (rawName || "").trim();

    // Ensure customer record exists
    let customer = await db.loyaltyCustomer.findUnique({
      where: {
        programId_phone: {
          programId: program.id,
          phone,
        },
      },
    });

    if (!customer) {
      customer = await db.loyaltyCustomer.create({
        data: {
          programId: program.id,
          phone,
          name: trimmedName || null,
          currentStamps: 0,
          lifetimeStamps: 0,
        },
      });
    } else if (trimmedName && !customer.name) {
      customer = await db.loyaltyCustomer.update({
        where: { id: customer.id },
        data: { name: trimmedName },
      });
    }

    // Check if customer already collected a stamp today (enforce 1 stamp per visit/day)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayTx = await db.loyaltyTransaction.findFirst({
      where: {
        programId: program.id,
        customerId: customer.id,
        stampsCount: { gt: 0 },
        createdAt: { gte: startOfToday },
      },
      include: {
        customer: {
          include: {
            rewards: { orderBy: { createdAt: "desc" } },
            transactions: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        },
      },
    });

    if (todayTx && todayTx.customer) {
      return NextResponse.json({
        success: true,
        alreadyCollected: true,
        message: "You already collected your stamp for today's visit!",
        customer: todayTx.customer,
      });
    }

    // Check if there is already an active PENDING request for this customer
    const existingPending = await db.stampRequest.findFirst({
      where: {
        restaurantId: qr.restaurantId,
        customerPhone: phone,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPending) {
      const response = NextResponse.json({
        success: true,
        alreadyPending: true,
        requestId: existingPending.id,
        status: existingPending.status,
        message: "Your stamp request is already pending approval with the restaurant owner.",
        tableNo: existingPending.tableNo || qr.tableNo || qr.name,
      });

      response.cookies.set(`loyalty_phone_${slug}`, phone, {
        path: "/",
        maxAge: 90 * 24 * 60 * 60,
        httpOnly: false,
        sameSite: "lax",
      });

      return response;
    }

    // Atomic transaction: Ensure no concurrent duplicate requests get created
    const stampRequest = await db.$transaction(async (tx) => {
      const pendingInTx = await tx.stampRequest.findFirst({
        where: {
          restaurantId: qr.restaurantId,
          customerPhone: phone,
          status: "PENDING",
        },
      });

      if (pendingInTx) {
        return pendingInTx;
      }

      return await tx.stampRequest.create({
        data: {
          restaurantId: qr.restaurantId,
          programId: program.id,
          customerId: customer.id,
          customerName: customer.name || trimmedName || "Valued Diner",
          customerPhone: phone,
          qrSlug: qr.slug,
          tableNo: qr.tableNo ? `Table ${qr.tableNo}` : qr.name || "Main Counter",
          status: "PENDING",
          stampsAwarded: 1,
        },
      });
    });

    const response = NextResponse.json({
      success: true,
      requestId: stampRequest.id,
      status: stampRequest.status,
      message: "Stamp request sent to owner! Waiting for approval...",
      tableNo: stampRequest.tableNo,
    });

    response.cookies.set(`loyalty_phone_${slug}`, phone, {
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: "lax",
    });

    if (customer.name) {
      response.cookies.set(`loyalty_name_${slug}`, encodeURIComponent(customer.name), {
        path: "/",
        maxAge: 90 * 24 * 60 * 60,
        httpOnly: false,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error: any) {
    console.error("[loyalty/request-stamp] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to request stamp" },
      { status: 500 }
    );
  }
}
