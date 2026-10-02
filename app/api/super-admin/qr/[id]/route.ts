import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";
import { QR_VALID_DAYS } from "@/lib/plans";
import { resolveStatus } from "@/lib/qr-status";

const schema = z.object({
  action: z.enum(["extend", "disable"]),
});

const DAY = 86_400_000;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { action } = parsed.data;
  const qr = await db.qrCode.findUnique({ where: { id: params.id }, include: { restaurant: true } });
  if (!qr) return NextResponse.json({ error: "QR not found." }, { status: 404 });

  if (action === "disable") {
    if (qr.status === "DISABLED") {
      return NextResponse.json({ error: "This QR code is already disabled." }, { status: 409 });
    }
    const updated = await db.qrCode.update({
      where: { id: qr.id },
      data: { status: "DISABLED" },
    });
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "qr.disable",
        target: qr.id,
        restaurantId: qr.restaurantId,
      },
    });
    return NextResponse.json({ ok: true, qr: updated });
  }

  if (resolveStatus(qr) !== "ACTIVE" || qr.restaurant.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Only active QRs can be extended. Verify payment to activate an unavailable QR." },
      { status: 409 },
    );
  }

  const now = Date.now();
  const base = qr.validUntil && qr.validUntil.getTime() > now ? qr.validUntil.getTime() : now;
  const updated = await db.qrCode.update({
    where: { id: qr.id },
    data: { validUntil: new Date(base + QR_VALID_DAYS * DAY) },
  });
  await db.auditLog.create({
    data: {
      actorId: admin.id,
      action: "qr.extend",
      target: qr.id,
      restaurantId: qr.restaurantId,
    },
  });
  return NextResponse.json({ ok: true, qr: updated });
}
