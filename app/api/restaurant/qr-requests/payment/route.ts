import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getQrPricePaise } from "@/lib/plans";
import { lockRestaurantQrRequest } from "@/lib/qr-request-lifecycle";

const schema = z.object({
  qrRequestId: z.string().min(1),
  reference: z.string().trim().min(1, "UTR is required").max(120),
  method: z.enum(["UPI", "BANK"]).default("UPI"),
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

  const { qrRequestId, reference, method } = parsed.data;
  let pricePerQr: number;
  try {
    pricePerQr = getQrPricePaise();
  } catch (error) {
    console.error("[PAYMENT] Invalid QR price configuration", error);
    return NextResponse.json({ error: "Payment amount is not configured correctly." }, { status: 500 });
  }

  let amount = 0;
  const payment = await db.$transaction(async (tx) => {
    const ownedRequest = await tx.qrRequest.findFirst({
      where: {
        id: qrRequestId,
        restaurant: { ownerId: ctx.user.id },
      },
      select: { restaurantId: true },
    });
    if (!ownedRequest) return { error: "NOT_FOUND" as const };

    const locked = await lockRestaurantQrRequest(tx, qrRequestId, ownedRequest.restaurantId);
    if (locked.length === 0) return { error: "NOT_FOUND" as const };

    const qrRequest = await tx.qrRequest.findUniqueOrThrow({
      where: { id: qrRequestId },
      include: { payments: { select: { id: true, status: true } } },
    });
    if (qrRequest.status !== "APPROVED_PAYMENT_DUE") {
      return { error: "INVALID_STATUS" as const };
    }
    if (qrRequest.payments.some((payment) => ["RECORDED", "PAID"].includes(payment.status))) {
      return { error: "PAYMENT_EXISTS" as const };
    }

    amount = pricePerQr * qrRequest.quantity;
    if (!Number.isSafeInteger(amount)) return { error: "AMOUNT_OUT_OF_RANGE" as const };

    const pendingPayment = qrRequest.payments.find((payment) => payment.status === "PENDING");
    const savedPayment = pendingPayment
      ? await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            amount,
            method,
            reference,
            status: "RECORDED",
            gatewayOrderId: null,
            gatewayPaymentId: null,
          },
        })
      : await tx.payment.create({
          data: {
            restaurantId: qrRequest.restaurantId,
            qrRequestId: qrRequest.id,
            amount,
            method,
            reference,
            status: "RECORDED",
          },
        });
    await tx.auditLog.create({
      data: {
        actorId: ctx.user.id,
        action: "payment.utr_submitted",
        target: savedPayment.id,
        restaurantId: qrRequest.restaurantId,
        meta: { qrRequestId: qrRequest.id, amount, reference, method },
      },
    });
    return { payment: savedPayment };
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
        { error: "A payment is already pending verification or has been paid for this request." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Payment amount is out of range." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, payment: payment.payment }, { status: 201 });
}
