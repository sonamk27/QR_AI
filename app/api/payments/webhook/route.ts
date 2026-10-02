import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGateway } from "@/lib/gateway";
import { confirmQrRequestPayment } from "@/lib/qr-request-lifecycle";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-razorpay-signature") ||
    req.headers.get("x-mock-signature") ||
    "";

  const gateway = getGateway();
  const result = gateway.verifyWebhookSignature(rawBody, signature);

  if (!result || !result.valid) {
    console.warn("[WEBHOOK] Invalid signature – rejecting");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { orderId, paymentId, amount } = result;

  // Idempotency: check if already processed
  const existingByPayId = await db.payment.findFirst({
    where: { gatewayPaymentId: paymentId },
  });
  if (existingByPayId) {
    console.log("[WEBHOOK] Already processed paymentId:", paymentId);
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Find the pending payment record by gateway order id
  const payment = await db.payment.findFirst({
    where: { gatewayOrderId: orderId, status: "PENDING", method: "GATEWAY" },
    include: { qrRequest: { include: { restaurant: true } } },
  });

  if (!payment) {
    console.warn("[WEBHOOK] No pending payment found for orderId:", orderId);
    return NextResponse.json({ error: "Payment not found or already processed" }, { status: 404 });
  }

  if (!payment.qrRequest) {
    console.warn("[WEBHOOK] Payment has no associated QR request:", payment.id);
    return NextResponse.json({ error: "No QR request linked" }, { status: 400 });
  }

  const qrRequest = payment.qrRequest;
  if (qrRequest.status !== "APPROVED_PAYMENT_DUE") {
    console.warn("[WEBHOOK] QR request is not awaiting payment:", qrRequest.id, qrRequest.status);
    return NextResponse.json({ error: "QR request is not awaiting payment." }, { status: 409 });
  }
  if (payment.amount !== amount) {
    console.warn("[WEBHOOK] Payment amount mismatch:", payment.id, amount, payment.amount);
    return NextResponse.json({ error: "Payment amount does not match the order." }, { status: 400 });
  }

  const activated = await db.$transaction((tx) =>
    confirmQrRequestPayment(
      tx,
      qrRequest,
      {
        id: payment.id,
        status: "PENDING",
        method: "GATEWAY",
        gatewayPaymentId: paymentId,
        reference: paymentId,
      },
      "webhook",
      "payment.webhook_paid",
      {
        orderId,
        paymentId,
        amount,
        qrRequestId: qrRequest.id,
        qrCount: qrRequest.quantity,
        isMock: result.isMock ?? false,
      },
    ),
  );
  if (!activated) {
    return NextResponse.json({ error: "QR request has already been processed." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
