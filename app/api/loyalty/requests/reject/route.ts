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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid rejection request is required." }, { status: 400 });
    }
    const { requestId, reason } = body;

    if (typeof requestId !== "string" || !requestId.trim()) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }
    if (typeof reason !== "undefined" && (typeof reason !== "string" || reason.length > 500)) {
      return NextResponse.json({ error: "Reason must be 500 characters or fewer." }, { status: 400 });
    }

    const restaurantId = ctx.restaurant.id;
    const staffNote = reason?.trim() || `Declined by ${ctx.user.name}`;
    const rejected = await db.$transaction(async (tx) => {
      const result = await tx.stampRequest.updateMany({
        where: { id: requestId, restaurantId, status: "PENDING" },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: ctx.user.id,
          staffNote,
        },
      });
      if (result.count === 1) {
        await tx.auditLog.create({
          data: {
            restaurantId,
            actorId: ctx.user.id,
            action: "stamp_request.rejected",
            target: requestId,
            meta: { staffNote },
          },
        });
      }
      return result.count === 1;
    });

    if (!rejected) {
      const exists = await db.stampRequest.findFirst({ where: { id: requestId, restaurantId }, select: { id: true } });
      return NextResponse.json(
        { error: exists ? "This stamp request has already been reviewed." : "Stamp request not found." },
        { status: exists ? 409 : 404 },
      );
    }

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
