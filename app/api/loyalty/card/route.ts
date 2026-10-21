import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerLoyaltyCard } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const restaurantIdParam = searchParams.get("restaurantId");
    const phone = searchParams.get("phone");
    const billParam = searchParams.get("billAmount");

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    let restaurantId = restaurantIdParam;

    if (!restaurantId && slug) {
      const qr = await db.qrCode.findUnique({
        where: { slug },
        select: { restaurantId: true },
      });
      if (qr) {
        restaurantId = qr.restaurantId;
      }
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        brandColor: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const cardData = await getCustomerLoyaltyCard(restaurantId, phone);

    // Optional dynamic real-time bill calculation
    let calculation = null;
    if (billParam && !isNaN(Number(billParam)) && Number(billParam) > 0) {
      const parsedBill = Number(billParam);
      const billPaise = Math.round(parsedBill * 100);
      const minPaise = cardData.program.minBillAmount;
      const qualifies = billPaise >= minPaise;

      let discountPaise = 0;
      if (qualifies) {
        if (cardData.program.discountType === "PERCENT") {
          discountPaise = Math.round((billPaise * cardData.program.rewardDiscount) / 100);
        } else {
          discountPaise = Math.min(billPaise, cardData.program.rewardDiscount);
        }
      }

      calculation = {
        billAmountRupees: parsedBill,
        qualifies,
        minBillAmountRupees: minPaise / 100,
        discountAmountRupees: discountPaise / 100,
        netPayableRupees: Math.max(0, (billPaise - discountPaise) / 100),
        amountNeededForOfferRupees: qualifies ? 0 : (minPaise - billPaise) / 100,
      };
    }

    return NextResponse.json({
      restaurant,
      ...cardData,
      calculation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load loyalty card" },
      { status: 500 }
    );
  }
}
