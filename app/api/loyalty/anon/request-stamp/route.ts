import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";
import { hashToken, COOKIE_NAME } from "@/lib/anon-session";

export const dynamic = "force-dynamic";

/**
 * POST /api/loyalty/anon/request-stamp
 *
 * Called by the anonymous customer (cookie-based) to request a stamp from the owner.
 * Creates a PENDING StampRequest that appears in the owner's dashboard for approval.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ error: "Restaurant QR slug is required" }, { status: 400 });
    }

    // Resolve QR code → restaurant
    const qr = await db.qrCode.findUnique({
      where: { slug },
      include: { restaurant: true },
    });

    if (!qr || qr.restaurant.status !== "ACTIVE") {
      return NextResponse.json({ error: "Restaurant not found or inactive" }, { status: 404 });
    }

    const restaurantId = qr.restaurantId;
    const program = await getOrCreateLoyaltyProgram(restaurantId);

    if (!program.isActive) {
      return NextResponse.json({ error: "Loyalty program is currently paused" }, { status: 400 });
    }

    // Resolve anonymous session from HttpOnly cookie
    const rawToken = req.cookies.get(COOKIE_NAME)?.value;
    if (!rawToken) {
      return NextResponse.json(
        { error: "Anonymous session not found. Please reload your loyalty card." },
        { status: 401 }
      );
    }

    const tokenHash = hashToken(rawToken.trim());
    const now = new Date();

    const session = await db.anonymousSession.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.customer ||
      session.customer.restaurantId !== restaurantId ||
      session.customer.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        { error: "Session expired or invalid. Please reload your loyalty card." },
        { status: 401 }
      );
    }

    const anonCustomer = session.customer;

    // Check for an existing PENDING request within the last 15 minutes (dedup)
    const existingPending = await db.stampRequest.findFirst({
      where: {
        restaurantId,
        anonCustomerId: anonCustomer.id,
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPending) {
      return NextResponse.json({
        success: true,
        alreadyPending: true,
        requestId: existingPending.id,
        status: existingPending.status,
        message: "Your stamp request is already pending approval with the restaurant owner.",
        tableNo: existingPending.tableNo || qr.tableNo || qr.name,
      });
    }

    // Check if they already received a stamp very recently (2-minute rapid dedup)
    const recentTx = await db.anonymousStampTransaction.findFirst({
      where: {
        customerId: anonCustomer.id,
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      },
    });

    if (recentTx) {
      return NextResponse.json({
        success: true,
        alreadyCollected: true,
        message: "You already received a stamp for this visit!",
      });
    }

    // Create a new StampRequest for owner review
    const stampRequest = await db.stampRequest.create({
      data: {
        restaurantId,
        programId: program.id,
        anonCustomerId: anonCustomer.id,
        customerName: `Anonymous Guest (${anonCustomer.id.slice(5, 13)})`,
        tableNo: qr.tableNo ? `Table ${qr.tableNo}` : qr.name || "Main Counter",
        qrSlug: qr.slug,
        status: "PENDING",
        stampsAwarded: 1,
      },
    });

    return NextResponse.json({
      success: true,
      requestId: stampRequest.id,
      status: stampRequest.status,
      message: "Stamp request sent to owner! Waiting for approval…",
      tableNo: stampRequest.tableNo,
    });
  } catch (error: any) {
    console.error("[loyalty/anon/request-stamp] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to request stamp" },
      { status: 500 }
    );
  }
}
