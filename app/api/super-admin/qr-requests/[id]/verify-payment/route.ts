import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";
import { getQrPricePaise } from "@/lib/plans";
import {
  confirmQrRequestPayment,
  lockRestaurantQrRequest,
} from "@/lib/qr-request-lifecycle";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let pricePerQr: number;
  try {
    pricePerQr = getQrPricePaise();
  } catch (error) {
    console.error("[PAYMENT] Invalid QR price configuration", error);
    return NextResponse.json({ error: "Payment amount is not configured correctly." }, { status: 500 });
  }

  const result = await db.$transaction(async (tx) => {
    const requestSummary = await tx.qrRequest.findUnique({
      where: { id: params.id },
      select: { id: true, restaurantId: true },
    });
    if (!requestSummary) return "NOT_FOUND" as const;

    const locked = await lockRestaurantQrRequest(tx, params.id, requestSummary.restaurantId);
    if (locked.length === 0) return "NOT_FOUND" as const;

    const qrRequest = await tx.qrRequest.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        payments: {
          where: {
            status: { in: ["RECORDED", "PENDING"] },
            method: { in: ["UPI", "BANK"] },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (qrRequest.status !== "APPROVED_PAYMENT_DUE") return "INVALID_STATUS" as const;

    const amount = pricePerQr * qrRequest.quantity;
    if (!Number.isSafeInteger(amount)) return "INVALID_AMOUNT" as const;

    const payment = qrRequest.payments.find((candidate) => candidate.status === "RECORDED")
      ?? qrRequest.payments[0];
    const manualReference = `MANUAL-${qrRequest.id}`;
    const paymentToConfirm = payment
      ? payment.status === "PENDING"
        ? await tx.payment.update({
            where: { id: payment.id },
            data: {
              amount,
              method: "UPI",
              reference: manualReference,
              gatewayOrderId: null,
              gatewayPaymentId: null,
            },
          })
        : payment
      : await tx.payment.create({
          data: {
            restaurantId: qrRequest.restaurantId,
            qrRequestId: qrRequest.id,
            amount,
            method: "UPI",
            reference: manualReference,
            status: "PENDING",
          },
        });
    const paymentStatus = payment?.status === "RECORDED" ? "RECORDED" : "PENDING";
    const activated = await confirmQrRequestPayment(
      tx,
      qrRequest,
      {
        id: paymentToConfirm.id,
        status: paymentStatus,
        method: paymentToConfirm.method,
        reference: paymentToConfirm.reference,
      },
      admin.id,
      "payment.manual_qr_verified",
      {
        qrRequestId: qrRequest.id,
        qrCount: qrRequest.quantity,
        amount,
        paymentMethod: paymentToConfirm.method,
      },
    );
    return activated ? "OK" as const : "ALREADY_PROCESSED" as const;
  }, { maxWait: 10_000, timeout: 30_000 });

  if (result === "NOT_FOUND") {
    return NextResponse.json({ error: "QR request not found." }, { status: 404 });
  }
  if (result === "INVALID_STATUS") {
    return NextResponse.json({ error: "Only approved requests can be verified." }, { status: 400 });
  }
  if (result === "INVALID_AMOUNT") {
    return NextResponse.json({ error: "Payment amount is out of range." }, { status: 500 });
  }
  if (result === "ALREADY_PROCESSED") {
    return NextResponse.json(
      { error: "This request has already moved out of the payment-due state." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
