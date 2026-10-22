import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken, COOKIE_NAME } from "@/lib/anon-session";

export const dynamic = "force-dynamic";

/**
 * GET /api/loyalty/anon/request-stamp/status?slug=xxx&requestId=yyy
 *
 * Polls the status of an anonymous customer's pending stamp request.
 * Used by the customer-facing card to show real-time approval status.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const requestId = searchParams.get("requestId");

    if (!slug || !requestId) {
      return NextResponse.json({ error: "slug and requestId are required" }, { status: 400 });
    }

    // Resolve QR → restaurantId
    const qr = await db.qrCode.findUnique({
      where: { slug },
      select: { restaurantId: true },
    });

    if (!qr) {
      return NextResponse.json({ error: "QR code not found" }, { status: 404 });
    }

    // Verify the session cookie matches the request
    const rawToken = req.cookies.get(COOKIE_NAME)?.value;
    if (!rawToken) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const tokenHash = hashToken(rawToken.trim());
    const session = await db.anonymousSession.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });

    if (!session || !session.customer || session.customer.restaurantId !== qr.restaurantId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Fetch the stamp request (must belong to this anon customer)
    const stampRequest = await db.stampRequest.findFirst({
      where: {
        id: requestId,
        restaurantId: qr.restaurantId,
        anonCustomerId: session.customer.id,
      },
      select: {
        id: true,
        status: true,
        stampsAwarded: true,
        createdAt: true,
        reviewedAt: true,
        staffNote: true,
        tableNo: true,
        anonCustomer: {
          select: { currentStamps: true, lifetimeStamps: true },
        },
      },
    });

    if (!stampRequest) {
      return NextResponse.json({ error: "Stamp request not found" }, { status: 404 });
    }

    return NextResponse.json({
      requestId: stampRequest.id,
      status: stampRequest.status,
      stampsAwarded: stampRequest.stampsAwarded,
      tableNo: stampRequest.tableNo,
      createdAt: stampRequest.createdAt,
      reviewedAt: stampRequest.reviewedAt,
      staffNote: stampRequest.staffNote,
      currentStamps: stampRequest.anonCustomer?.currentStamps ?? null,
    });
  } catch (error: any) {
    console.error("[loyalty/anon/request-stamp/status] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to check stamp request status" },
      { status: 500 }
    );
  }
}
