import { createHmac, timingSafeEqual } from "crypto";

/**
 * Payment Gateway Adapter Interface
 *
 * Allows swapping Razorpay for any other gateway without touching business logic.
 * In dev mode (PAYMENT_GATEWAY=mock or no Razorpay keys), the MockGateway is used.
 * The mock is clearly labeled in all responses.
 */

export interface GatewayOrder {
  id: string;          // gateway's order id
  amount: number;      // paise
  currency: string;
  receipt: string;
  isMock?: boolean;
}

export interface GatewayWebhookResult {
  valid: boolean;
  orderId: string;
  paymentId: string;
  amount: number;      // paise
  isMock?: boolean;
}

export interface PaymentGateway {
  name: string;
  isMock: boolean;
  createOrder(params: { amount: number; receipt: string; currency?: string }): Promise<GatewayOrder>;
  verifyWebhookSignature(rawBody: string, signature: string): GatewayWebhookResult | null;
}

// ---------------------------------------------------------------------------
// MOCK GATEWAY – used in dev when Razorpay keys are absent
// ---------------------------------------------------------------------------
class MockGateway implements PaymentGateway {
  readonly name = "Mock (dev only)";
  readonly isMock = true;

  async createOrder(params: { amount: number; receipt: string }): Promise<GatewayOrder> {
    const id = `mock_order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.warn("[MOCK GATEWAY] createOrder called – not a real payment. id:", id);
    return {
      id,
      amount: params.amount,
      currency: "INR",
      receipt: params.receipt,
      isMock: true,
    };
  }

  verifyWebhookSignature(rawBody: string, _signature: string): GatewayWebhookResult | null {
    try {
      const payload = JSON.parse(rawBody);
      const entity = payload?.payload?.payment?.entity;
      if (payload?.event !== "payment.captured" || entity?.status !== "captured") return null;
      if (
        typeof entity.order_id !== "string" ||
        typeof entity.id !== "string" ||
        !Number.isSafeInteger(entity.amount)
      ) return null;
      return {
        valid: true,
        orderId: entity.order_id,
        paymentId: entity.id,
        amount: entity.amount,
        isMock: true,
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// RAZORPAY GATEWAY
// ---------------------------------------------------------------------------
class RazorpayGateway implements PaymentGateway {
  readonly name = "Razorpay";
  readonly isMock = false;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(keyId: string, keySecret: string, webhookSecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  async createOrder(params: { amount: number; receipt: string; currency?: string }): Promise<GatewayOrder> {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency ?? "INR",
        receipt: params.receipt,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Razorpay createOrder failed: ${err}`);
    }

    const data: any = await res.json();
    return { id: data.id, amount: data.amount, currency: data.currency, receipt: data.receipt };
  }

  verifyWebhookSignature(rawBody: string, signature: string): GatewayWebhookResult | null {
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    if (!/^[a-f\d]{64}$/i.test(signature)) return null;
    const expectedBytes = Buffer.from(expected, "hex");
    const signatureBytes = Buffer.from(signature, "hex");
    if (!timingSafeEqual(expectedBytes, signatureBytes)) return null;

    try {
      const payload = JSON.parse(rawBody);
      const entity = payload?.payload?.payment?.entity;
      if (payload?.event !== "payment.captured" || entity?.status !== "captured") return null;
      if (
        typeof entity.order_id !== "string" ||
        typeof entity.id !== "string" ||
        !Number.isSafeInteger(entity.amount)
      ) return null;
      return {
        valid: true,
        orderId: entity.order_id,
        paymentId: entity.id,
        amount: entity.amount,
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory – returns the correct implementation based on env
// ---------------------------------------------------------------------------
let _gateway: PaymentGateway | null = null;

export function getGateway(): PaymentGateway {
  if (_gateway) return _gateway;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const forceMock = process.env.PAYMENT_GATEWAY === "mock";

  if (process.env.NODE_ENV === "production") {
    if (forceMock || !keyId || !keySecret || !webhookSecret) {
      throw new Error("Razorpay credentials and webhook secret are required in production.");
    }
  }

  if (!forceMock && keyId && keySecret && webhookSecret) {
    _gateway = new RazorpayGateway(keyId, keySecret, webhookSecret);
  } else {
    _gateway = new MockGateway();
  }

  return _gateway;
}
