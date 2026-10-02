import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";

const schema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required.").max(500),
});

/**
 * POST /api/super-admin/qr-requests/[id]/reject
 *
 * Rejects a PENDING_APPROVAL QR request with a mandatory reason.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const { reason } = parsed.data;

  const qrRequest = await db.qrRequest.findUnique({ where: { id } });
  if (!qrRequest) {
    return NextResponse.json({ error: "QR request not found." }, { status: 404 });
  }

  const rejected = await db.$transaction(async (tx) => {
    const updated = await tx.qrRequest.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    if (updated.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "qr_request.rejected",
        target: id,
        restaurantId: qrRequest.restaurantId,
        meta: { reason },
      },
    });
    return true;
  });
  if (!rejected) {
    return NextResponse.json(
      { error: "Only pending-approval requests can be rejected." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
