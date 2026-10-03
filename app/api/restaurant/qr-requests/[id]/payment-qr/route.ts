import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQrPricePaise } from "@/lib/plans";
import { buildUpiPaymentUri } from "@/lib/upi-payment";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await db.qrRequest.findFirst({
    where: {
      id: params.id,
      restaurant: { ownerId: ctx.user.id },
      status: "APPROVED_PAYMENT_DUE",
      payments: { none: { status: { in: ["RECORDED", "PAID"] } } },
    },
    select: { id: true, quantity: true },
  });
  if (!request) {
    return NextResponse.json(
      { error: "An approved, unpaid QR request was not found." },
      { status: 404 },
    );
  }

  const payeeVpa = process.env.UPI_VPA?.trim();
  if (!payeeVpa) {
    return NextResponse.json(
      { error: "UPI payments are not configured. Contact the administrator." },
      { status: 503 },
    );
  }

  let amountPaise: number;
  try {
    amountPaise = getQrPricePaise() * request.quantity;
    if (!Number.isSafeInteger(amountPaise)) {
      throw new Error("QR request payment amount is out of range.");
    }
  } catch (error) {
    console.error("[PAYMENT QR] Invalid payment configuration", error);
    return NextResponse.json(
      { error: "Payment amount is not configured correctly." },
      { status: 500 },
    );
  }

  const paymentUri = buildUpiPaymentUri({
    payeeVpa,
    payeeName: process.env.UPI_PAYEE_NAME ?? "ReviewFlow",
    amountPaise,
    requestId: request.id,
  });
  const png = await QRCode.toBuffer(paymentUri, {
    type: "png",
    margin: 2,
    width: 640,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
