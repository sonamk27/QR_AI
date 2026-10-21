import { NextRequest, NextResponse } from "next/server";
import { verifyTerminalPinWithRateLimit } from "@/lib/loyalty-security";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId: reqRestaurantId, slug, pin } = body;

    let restaurantId = reqRestaurantId;
    if (!restaurantId && slug) {
      const qr = await db.qrCode.findUnique({
        where: { slug },
        select: { restaurantId: true },
      });
      if (qr) restaurantId = qr.restaurantId;
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant is required" }, { status: 400 });
    }

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown-ip";

    const result = await verifyTerminalPinWithRateLimit(restaurantId, pin, ip);

    if (!result.valid) {
      return NextResponse.json(
        {
          error: result.error,
          isLocked: result.isLocked,
          minsRemaining: result.minsRemaining,
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: result.isLocked ? 429 : 401 }
      );
    }

    return NextResponse.json({
      success: true,
      isDefaultPin: result.isDefaultPin,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to verify PIN" },
      { status: 500 }
    );
  }
}
