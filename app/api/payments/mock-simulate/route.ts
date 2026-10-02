import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";

const schema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().optional(),
});

/**
 * DEV-ONLY: Simulates a payment webhook from the mock gateway.
 * This calls the real /api/payments/webhook endpoint with a mock payload.
 * Only works when PAYMENT_GATEWAY=mock or when no Razorpay keys are set.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const { orderId } = parsed.data;
  const pendingPayment = await db.payment.findFirst({
    where: {
      gatewayOrderId: orderId,
      restaurantId: ctx.restaurant.id,
      status: "PENDING",
    },
    select: { amount: true },
  });
  if (!pendingPayment) {
    return NextResponse.json({ error: "Pending payment order not found." }, { status: 404 });
  }
  const simulatedPaymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Construct a Razorpay-like webhook payload
  const mockPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: simulatedPaymentId,
          order_id: orderId,
          amount: pendingPayment.amount,
          currency: "INR",
          status: "captured",
        },
      },
    },
    orderId,
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const webhookRes = await fetch(`${appUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-signature": "mock-bypass",
    },
    body: mockPayload,
  });

  const data = await webhookRes.json().catch(() => ({}));
  return NextResponse.json({
    ok: webhookRes.ok,
    simulatedPaymentId,
    webhookStatus: webhookRes.status,
    webhookResponse: data,
    _warning: "⚠️ MOCK SIMULATION – not a real payment",
  });
}
