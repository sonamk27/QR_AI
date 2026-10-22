import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getOrCreateAnonSession,
  setAnonSessionCookie,
  getAnonCustomerLoyaltyCard,
} from "@/lib/anon-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const restaurantIdParam = searchParams.get("restaurantId");
    const billParam = searchParams.get("billAmount");

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

    // Resolves anonymous cookie or creates new anonymous identity
    const sessionResult = await getOrCreateAnonSession(req, restaurantId);
    const cardData = await getAnonCustomerLoyaltyCard(restaurantId, sessionResult.customerId);

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

    const response = NextResponse.json({
      restaurant,
      program: cardData.program,
      customer: cardData.customer,
      calculation,
      isNewSession: sessionResult.isNew,
    });

    // Set cookie if new session was created
    if (sessionResult.isNew && sessionResult.token) {
      setAnonSessionCookie(response, sessionResult.token);
    }

    return response;
  } catch (error: any) {
    console.error("[loyalty/anon/card] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load anonymous loyalty card" },
      { status: 500 }
    );
  }
}
