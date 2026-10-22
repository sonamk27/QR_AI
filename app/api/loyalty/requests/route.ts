import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurantId = ctx.restaurant.id;

    // Fetch pending requests (phone-based + anonymous)
    const pendingRequests = await db.stampRequest.findMany({
      where: {
        restaurantId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            currentStamps: true,
            lifetimeStamps: true,
          },
        },
        anonCustomer: {
          select: {
            currentStamps: true,
            lifetimeStamps: true,
          },
        },
      },
      take: 50,
    });

    // Fetch recent reviewed requests (last 24 hours, max 15)
    const recentReviewed = await db.stampRequest.findMany({
      where: {
        restaurantId,
        status: { in: ["APPROVED", "REJECTED"] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { reviewedAt: "desc" },
      include: {
        customer: {
          select: {
            currentStamps: true,
            lifetimeStamps: true,
          },
        },
        anonCustomer: {
          select: {
            currentStamps: true,
            lifetimeStamps: true,
          },
        },
      },
      take: 15,
    });

    return NextResponse.json({
      pending: pendingRequests,
      recent: recentReviewed,
      pendingCount: pendingRequests.length,
    });
  } catch (error: any) {
    console.error("[loyalty/requests] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch stamp requests" },
      { status: 500 }
    );
  }
}
