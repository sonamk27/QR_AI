import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerLoyaltyCard, normalizePhone } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");
    const rawPhone = searchParams.get("phone");
    const slug = searchParams.get("slug");

    let stampRequest = null;

    if (requestId) {
      stampRequest = await db.stampRequest.findUnique({
        where: { id: requestId },
        include: { restaurant: true },
      });
    } else if (rawPhone && slug) {
      const phone = normalizePhone(rawPhone);
      const qr = await db.qrCode.findUnique({
        where: { slug },
        select: { restaurantId: true },
      });

      if (qr) {
        stampRequest = await db.stampRequest.findFirst({
          where: {
            restaurantId: qr.restaurantId,
            customerPhone: phone,
            createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
          },
          orderBy: { createdAt: "desc" },
          include: { restaurant: true },
        });
      }
    }

    if (!stampRequest) {
      return NextResponse.json({ status: "NONE" });
    }

    if (stampRequest.status === "APPROVED") {
      const cardData = await getCustomerLoyaltyCard(
        stampRequest.restaurantId,
        stampRequest.customerPhone
      );

      return NextResponse.json({
        status: "APPROVED",
        requestId: stampRequest.id,
        stampsAwarded: stampRequest.stampsAwarded,
        message: "🎉 Your stamp has been approved by the restaurant owner!",
        customer: cardData.customer,
        program: cardData.program,
        reviewedAt: stampRequest.reviewedAt,
      });
    }

    if (stampRequest.status === "REJECTED") {
      return NextResponse.json({
        status: "REJECTED",
        requestId: stampRequest.id,
        message: "Your stamp request was declined by the restaurant.",
      });
    }

    return NextResponse.json({
      status: "PENDING",
      requestId: stampRequest.id,
      customerName: stampRequest.customerName,
      customerPhone: stampRequest.customerPhone,
      tableNo: stampRequest.tableNo,
      createdAt: stampRequest.createdAt,
      message: "Waiting for owner approval...",
    });
  } catch (error: any) {
    console.error("[loyalty/request-stamp/status] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to check stamp request status" },
      { status: 500 }
    );
  }
}
