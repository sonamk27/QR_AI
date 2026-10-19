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

    return NextResponse.json({
      restaurant,
      ...cardData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load loyalty card" },
      { status: 500 }
    );
  }
}
