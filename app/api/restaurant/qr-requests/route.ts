import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { newSlug } from "@/lib/qr";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  location: z.string().trim().max(60).optional(),
  tableNo: z.string().trim().max(20).optional(),
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
  const result = await db.$transaction(async (tx) => {
    // Serialize request creation for this restaurant so a double-submit cannot
    // create multiple open requests or bypass the one-primary-QR rule.
    await tx.$queryRaw`
      SELECT id FROM "Restaurant" WHERE id = ${ctx.restaurant.id} FOR UPDATE
    `;

    const existingQr = await tx.qrCode.findFirst({
      where: { restaurantId: ctx.restaurant.id, status: { not: "PENDING_PAYMENT" } },
      select: { id: true },
    });
    if (existingQr) return { error: "HAS_QR" as const };

    const openRequest = await tx.qrRequest.findFirst({
      where: {
        restaurantId: ctx.restaurant.id,
        status: { in: ["PENDING_APPROVAL", "APPROVED_PAYMENT_DUE"] },
      },
      select: { id: true },
    });
    if (openRequest) return { error: "REQUEST_OPEN" as const };

    const request = await tx.qrRequest.create({
      data: {
        restaurantId: ctx.restaurant.id,
        name,
        location: location || undefined,
        tableNo: tableNo || undefined,
        quantity,
        note: note?.trim() || undefined,
      },
    });

    await tx.qrCode.create({
      data: {
        restaurantId: ctx.restaurant.id,
        qrRequestId: request.id,
        name,
        location: location || undefined,
        tableNo: tableNo || undefined,
        slug: newSlug(),
        status: "PENDING_PAYMENT",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: ctx.user.id,
        action: "qr_request.submit",
        target: request.id,
        restaurantId: ctx.restaurant.id,
        meta: { restaurantId: ctx.restaurant.id, name, quantity },
      },
    });
    return { request };
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "HAS_QR"
        ? "This restaurant already has a QR code. Only one QR is allowed per restaurant."
        : "Your QR request is already awaiting review or payment." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, request: result.request }, { status: 201 });
}
