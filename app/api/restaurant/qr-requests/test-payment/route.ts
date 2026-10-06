import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQrPricePaise } from "@/lib/plans";
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

    let pricePerQr: number;
    try {
      pricePerQr = getQrPricePaise();
    } catch (error) {
      console.error("[TEST PAYMENT] Invalid QR price configuration", error);
      return { error: "INVALID_AMOUNT" as const };
    }
    const amount = pricePerQr * request.quantity;
    if (!Number.isSafeInteger(amount)) {
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
  }, { maxWait: 10_000, timeout: 30_000 });

  if ("error" in result) {
    switch (result.error) {
      case "NOT_FOUND":
        return NextResponse.json({ error: "QR request not found." }, { status: 404 });
      case "INVALID_STATUS":
        return NextResponse.json(
          { error: "This request is not awaiting payment." },
          { status: 409 },
        );
      case "PAYMENT_EXISTS":
        return NextResponse.json(
          { error: "A payment is already submitted or complete." },
          { status: 409 },
        );
      case "INVALID_AMOUNT":
        return NextResponse.json(
          { error: "Payment amount is not configured correctly." },
          { status: 500 },
        );
      case "ALREADY_PROCESSED":
        return NextResponse.json(
          { error: "This request has already been processed." },
          { status: 409 },
        );
    }
  }

  return NextResponse.json({ ok: true, testPayment: true, reference: result.reference });
}
