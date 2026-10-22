import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { requestId, reason } = body;

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const restaurantId = ctx.restaurant.id;

    const stampReq = await db.stampRequest.findFirst({
      where: {
        id: requestId,
        restaurantId,
      },
    });

    if (!stampReq) {
      return NextResponse.json({ error: "Stamp request not found" }, { status: 404 });
    }

    if (stampReq.status === "APPROVED") {
      return NextResponse.json(
        { error: "Cannot decline a stamp that has already been approved" },
        { status: 400 }
      );
    }

    await db.stampRequest.update({
      where: { id: stampReq.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: ctx.user.id,
        staffNote: reason || `Declined by ${ctx.user.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stamp request declined",
    });
  } catch (error: any) {
    console.error("[loyalty/requests/reject] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to decline stamp request" },
      { status: 500 }
    );
  }
}
