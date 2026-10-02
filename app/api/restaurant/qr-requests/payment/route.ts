import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { lockRestaurantQrRequest } from "@/lib/qr-request-lifecycle";

const schema = z.object({
  qrRequestId: z.string().min(1),
  reference: z.string().trim().min(1, "UTR is required").max(120),
});

export async function POST(req: Request) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
      { status: 400 },
    );
  }

  const { qrRequestId, reference } = parsed.data;
  const pricePerQr = Number.parseInt(process.env.QR_PRICE_PAISE || "99900", 10);
  if (!Number.isSafeInteger(pricePerQr) || pricePerQr <= 0) {
    console.error("[PAYMENT] QR_PRICE_PAISE must be a positive integer");
    return NextResponse.json({ error: "Payment amount is not configured correctly." }, { status: 500 });
  }

  let amount = 0;
  const payment = await db.$transaction(async (tx) => {
    const locked = await lockRestaurantQrRequest(tx, qrRequestId, ctx.restaurant.id);
    if (locked.length === 0) return { error: "NOT_FOUND" as const };

    const qrRequest = await tx.qrRequest.findUniqueOrThrow({
      where: { id: qrRequestId },
      include: { payments: { select: { status: true } } },
    });
    if (qrRequest.status !== "APPROVED_PAYMENT_DUE") {
      return { error: "INVALID_STATUS" as const };
    }
    if (qrRequest.payments.some((payment) => ["PENDING", "RECORDED", "PAID"].includes(payment.status))) {
      return { error: "PAYMENT_EXISTS" as const };
    }

    amount = pricePerQr * qrRequest.quantity;
    if (!Number.isSafeInteger(amount)) return { error: "AMOUNT_OUT_OF_RANGE" as const };

    const created = await tx.payment.create({
      data: {
        restaurantId: ctx.restaurant.id,
        qrRequestId: qrRequest.id,
        amount,
        method: "UPI",
        reference,
        status: "RECORDED",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: ctx.user.id,
        action: "payment.utr_submitted",
        target: created.id,
        restaurantId: ctx.restaurant.id,
        meta: { qrRequestId: qrRequest.id, amount, reference },
      },
    });
    return { payment: created };
  });

  if ("error" in payment) {
    if (payment.error === "NOT_FOUND") {
      return NextResponse.json({ error: "QR request not found." }, { status: 404 });
    }
    if (payment.error === "INVALID_STATUS") {
      return NextResponse.json({ error: "This request is not awaiting payment." }, { status: 409 });
    }
    if (payment.error === "PAYMENT_EXISTS") {
      return NextResponse.json(
        { error: "A payment is already pending verification for this request." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Payment amount is out of range." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, payment: payment.payment }, { status: 201 });
}
