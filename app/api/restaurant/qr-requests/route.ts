import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(60),
  location: z.string().max(60).optional(),
  tableNo: z.string().max(20).optional(),
  quantity: z.number().int().min(1).max(1).default(1),
  note: z.string().max(500).optional(),
});

// GET: list QR requests for this restaurant
export async function GET() {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db.qrRequest.findMany({
    where: { restaurant: { ownerId: ctx.user.id } },
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: { select: { name: true } },
      qrCodes: { select: { id: true, slug: true, status: true } },
      payments: {
        select: {
          id: true,
          status: true,
          amount: true,
          gatewayOrderId: true,
          method: true,
          reference: true,
        },
      },
    },
  });

  return NextResponse.json({ requests });
}

// POST: submit a new QR request
export async function POST(req: Request) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { name, location, tableNo, note } = parsed.data;
  const quantity = 1;

  const existingQr = await db.qrCode.findFirst({
    where: { restaurantId: ctx.restaurant.id },
    select: { id: true },
  });
  if (existingQr) {
    return NextResponse.json(
      { error: "This restaurant already has a QR code. Only one QR is allowed per restaurant." },
      { status: 409 },
    );
  }

  const request = await db.qrRequest.create({
    data: {
      restaurantId: ctx.restaurant.id,
      name: name.trim(),
      location: location?.trim() || undefined,
      tableNo: tableNo?.trim() || undefined,
      quantity,
      note: note?.trim() || undefined,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: ctx.user.id,
      action: "qr_request.submit",
      target: request.id,
      restaurantId: ctx.restaurant.id,
      meta: { restaurantId: ctx.restaurant.id, name, quantity },
    },
  });

  return NextResponse.json({ ok: true, request }, { status: 201 });
}
