import type { PaymentMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { newSlug } from "@/lib/qr";
import { QR_VALID_DAYS } from "@/lib/plans";

const DAY = 86_400_000;

type ApprovedRequest = {
  id: string;
  restaurantId: string;
  name: string;
  location: string | null;
  tableNo: string | null;
  quantity: number;
};

async function nextInvoiceNo(tx: Prisma.TransactionClient) {
  const count = await tx.payment.count();
  return `RF-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
}

export async function confirmQrRequestPayment(
  tx: Prisma.TransactionClient,
  request: ApprovedRequest,
  payment: {
    id: string;
    status: "PENDING" | "RECORDED";
    method: PaymentMethod;
    gatewayPaymentId?: string;
    reference?: string;
  },
  actorId: string,
  auditAction: string,
  auditMeta: Prisma.InputJsonObject,
) {
  const movedToPaid = await tx.qrRequest.updateMany({
    where: { id: request.id, restaurantId: request.restaurantId, status: "APPROVED_PAYMENT_DUE" },
    data: { status: "PAID" },
  });
  if (movedToPaid.count !== 1) return false;

  const invoiceNo = await nextInvoiceNo(tx);
  const markedPaid = await tx.payment.updateMany({
    where: {
      id: payment.id,
      qrRequestId: request.id,
      status: payment.status,
      method: payment.method,
    },
    data: {
      status: "PAID",
      invoiceNo,
      gatewayPaymentId: payment.gatewayPaymentId,
      reference: payment.reference,
    },
  });
  if (markedPaid.count !== 1) {
    throw new Error("QR_REQUEST_PAYMENT_TRANSITION_CONFLICT");
  }

  const now = Date.now();
  await tx.qrCode.createMany({
    data: Array.from({ length: request.quantity }, (_, index) => ({
      restaurantId: request.restaurantId,
      qrRequestId: request.id,
      name: `${request.name}${request.quantity > 1 ? ` #${index + 1}` : ""}`,
      location: request.location ?? undefined,
      tableNo: request.tableNo ?? undefined,
      slug: newSlug(),
      status: "ACTIVE" as const,
      validFrom: new Date(now),
      validUntil: new Date(now + QR_VALID_DAYS * DAY),
    })),
  });

  const movedToActive = await tx.qrRequest.updateMany({
    where: { id: request.id, restaurantId: request.restaurantId, status: "PAID" },
    data: { status: "ACTIVE" },
  });
  if (movedToActive.count !== 1) {
    throw new Error("QR_REQUEST_ACTIVATION_CONFLICT");
  }

  await tx.auditLog.create({
    data: {
      actorId,
      action: auditAction,
      target: payment.id,
      restaurantId: request.restaurantId,
      meta: auditMeta,
    },
  });

  return true;
}

export async function lockRestaurantQrRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  restaurantId: string,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM qr_requests
    WHERE id = ${requestId} AND restaurant_id = ${restaurantId}
    FOR UPDATE
  `;
}
