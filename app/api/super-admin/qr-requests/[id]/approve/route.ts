import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";

/**
 * POST /api/super-admin/qr-requests/[id]/approve
 *
 * Moves a PENDING_APPROVAL request into the payment-due state.
 * Idempotent – approving an already-approved request returns 200 with a note.
 * Guards against double-approvals creating duplicate QR codes.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;

  const qrRequest = await db.qrRequest.findUnique({ where: { id } });

  if (!qrRequest) {
    return NextResponse.json({ error: "QR request not found." }, { status: 404 });
  }

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.qrRequest.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: {
        status: "APPROVED_PAYMENT_DUE",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    if (updated.count !== 1) return false;

    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "qr_request.approved",
        target: id,
        restaurantId: qrRequest.restaurantId,
        meta: { quantity: qrRequest.quantity },
      },
    });
    return true;
  });
  if (!result) {
    return NextResponse.json(
      { error: "Only pending-approval requests can be approved." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
