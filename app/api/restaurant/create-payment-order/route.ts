import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { getGateway } from "@/lib/gateway";
import { lockRestaurantQrRequest } from "@/lib/qr-request-lifecycle";

const schema = z.object({
  qrRequestId: z.string().min(1),
});

type PaymentOrderResult =
  | { error: "NOT_FOUND" | "INVALID_STATUS" | "ALREADY_PAID" | "MANUAL_PENDING" | "INVALID_AMOUNT" }
  | { paymentId: string; orderId: string; amount: number };

export async function POST(req: Request) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "qrRequestId is required" }, { status: 400 });
  }

  const { qrRequestId } = parsed.data;

  const gateway = getGateway();
  const paymentResult = await db.$transaction(async (tx): Promise<PaymentOrderResult> => {
    const locked = await lockRestaurantQrRequest(tx, qrRequestId, ctx.restaurant.id);
    if (locked.length === 0) return { error: "NOT_FOUND" as const };

    const qrRequest = await tx.qrRequest.findUniqueOrThrow({
      where: { id: qrRequestId },
      include: {
        payments: { where: { status: { in: ["PENDING", "PAID", "RECORDED"] } } },
      },
    });
    if (qrRequest.status !== "APPROVED_PAYMENT_DUE") {
      return { error: "INVALID_STATUS" as const };
    }
    if (qrRequest.payments.some((payment) => payment.status === "PAID")) {
      return { error: "ALREADY_PAID" as const };
    }
    if (qrRequest.payments.some((payment) => payment.status === "RECORDED")) {
      return { error: "MANUAL_PENDING" as const };
    }

    const existingPending = qrRequest.payments.find((payment) => payment.status === "PENDING");
    if (existingPending) {
      if (!existingPending.gatewayOrderId) {
        throw new Error(`Pending payment ${existingPending.id} has no gateway order ID.`);
      }
      return {
        paymentId: existingPending.id,
        orderId: existingPending.gatewayOrderId,
        amount: existingPending.amount,
      };
    }

    const pricePerQr = Number.parseInt(process.env.QR_PRICE_PAISE || "99900", 10);
    const totalAmount = pricePerQr * qrRequest.quantity;
    if (!Number.isSafeInteger(pricePerQr) || pricePerQr <= 0 || !Number.isSafeInteger(totalAmount)) {
      return { error: "INVALID_AMOUNT" as const };
    }

    const receipt = `qr_req_${qrRequest.id.slice(-8)}_${Date.now()}`;
    const order = await gateway.createOrder({ amount: totalAmount, receipt });
    const payment = await tx.payment.create({
      data: {
        restaurantId: ctx.restaurant.id,
        qrRequestId: qrRequest.id,
        amount: totalAmount,
        method: "GATEWAY",
        reference: order.id,
        status: "PENDING",
        gatewayOrderId: order.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: ctx.user.id,
        action: "payment.order_created",
        target: payment.id,
        restaurantId: ctx.restaurant.id,
        meta: { orderId: order.id, amount: totalAmount, isMock: gateway.isMock },
      },
    });
    return { paymentId: payment.id, orderId: order.id, amount: totalAmount };
  });

  if ("error" in paymentResult) {
    if (paymentResult.error === "NOT_FOUND") {
      return NextResponse.json({ error: "QR request not found." }, { status: 404 });
    }
    const messages = {
      INVALID_STATUS: "This request is not awaiting payment.",
      ALREADY_PAID: "This request is already paid.",
      MANUAL_PENDING: "A manual payment is awaiting verification.",
      INVALID_AMOUNT: "Payment amount is not configured correctly.",
    };
    return NextResponse.json(
      { error: messages[paymentResult.error] },
      { status: paymentResult.error === "INVALID_AMOUNT" ? 500 : 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId: paymentResult.orderId,
    paymentId: paymentResult.paymentId,
    amount: paymentResult.amount,
    currency: "INR",
    isMock: gateway.isMock,
    gatewayName: gateway.name,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
  });
}
