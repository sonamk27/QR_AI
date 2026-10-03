import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  confirmQrRequestPayment,
  lockRestaurantQrRequest,
} from "@/lib/qr-request-lifecycle";

const schema = z.object({
  qrRequestId: z.string().min(1),
});

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "qrRequestId is required" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const ownedRequest = await tx.qrRequest.findFirst({
      where: {
        id: parsed.data.qrRequestId,
        restaurant: { ownerId: ctx.user.id },
      },
      select: { restaurantId: true },
    });
    if (!ownedRequest) return { error: "NOT_FOUND" as const };

    const locked = await lockRestaurantQrRequest(
      tx,
      parsed.data.qrRequestId,
      ownedRequest.restaurantId,
    );
    if (locked.length === 0) return { error: "NOT_FOUND" as const };

    const request = await tx.qrRequest.findUniqueOrThrow({
      where: { id: parsed.data.qrRequestId },
      include: {
        payments: {
          where: { status: { in: ["PENDING", "RECORDED", "PAID"] } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (request.status !== "APPROVED_PAYMENT_DUE") {
      return { error: "INVALID_STATUS" as const };
    }

    const existingPayment = request.payments[0];
    if (existingPayment?.status === "RECORDED" || existingPayment?.status === "PAID") {
      return { error: "PAYMENT_EXISTS" as const };
    }

    const pricePerQr = Number.parseInt(process.env.QR_PRICE_PAISE || "99900", 10);
    const amount = pricePerQr * request.quantity;
    if (!Number.isSafeInteger(pricePerQr) || pricePerQr <= 0 || !Number.isSafeInteger(amount)) {
      return { error: "INVALID_AMOUNT" as const };
    }

    const reference = `TEST-${randomUUID()}`;
    const payment = existingPayment
      ? await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount,
            method: "UPI",
            reference,
            gatewayOrderId: null,
            gatewayPaymentId: null,
          },
        })
      : await tx.payment.create({
          data: {
            restaurantId: request.restaurantId,
            qrRequestId: request.id,
            amount,
            method: "UPI",
            reference,
            status: "PENDING",
          },
        });

    const activated = await confirmQrRequestPayment(
      tx,
      request,
      {
        id: payment.id,
        status: "PENDING",
        method: "UPI",
        reference,
      },
      ctx.user.id,
      "payment.test_simulated",
      { qrRequestId: request.id, qrCount: request.quantity, amount, testPayment: true },
    );
    if (!activated) return { error: "ALREADY_PROCESSED" as const };

    return { ok: true, reference };
  });

  if ("error" in result) {
    const errors = {
      NOT_FOUND: { error: "QR request not found.", status: 404 },
      INVALID_STATUS: { error: "This request is not awaiting payment.", status: 409 },
      PAYMENT_EXISTS: { error: "A payment is already submitted or complete.", status: 409 },
      INVALID_AMOUNT: { error: "Payment amount is not configured correctly.", status: 500 },
      ALREADY_PROCESSED: { error: "This request has already been processed.", status: 409 },
    } as const;
    const failure = errors[result.error];
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  return NextResponse.json({ ok: true, testPayment: true, reference: result.reference });
}
