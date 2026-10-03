import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";
import { confirmQrRequestPayment } from "@/lib/qr-request-lifecycle";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const qrRequest = await db.qrRequest.findUnique({
    where: { id: params.id },
    include: {
      payments: { where: { status: "RECORDED", method: { in: ["UPI", "BANK"] } }, take: 1 },
    },
  });
  if (!qrRequest) {
    return NextResponse.json({ error: "QR request not found." }, { status: 404 });
  }
  if (qrRequest.status !== "APPROVED_PAYMENT_DUE") {
    return NextResponse.json({ error: "Only approved requests can be verified." }, { status: 400 });
  }
  const payment = qrRequest.payments[0];
  if (!payment) {
    return NextResponse.json({ error: "No submitted UPI or bank payment is awaiting verification." }, { status: 404 });
  }

  const activated = await db.$transaction((tx) =>
    confirmQrRequestPayment(
      tx,
      qrRequest,
      { id: payment.id, status: "RECORDED", method: payment.method },
      admin.id,
      "payment.utr_verified",
      { qrRequestId: qrRequest.id, qrCount: qrRequest.quantity },
    ),
  );

  if (!activated) {
    return NextResponse.json(
      { error: "This request has already moved out of the payment-due state." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
