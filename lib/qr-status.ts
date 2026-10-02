import type { QrStatus } from "@prisma/client";
import { GRACE_DAYS } from "./plans";

const DAY = 86_400_000;

/** Status computed from validity dates, so scans stay correct even if the cron is late. */
export function resolveStatus(qr: { status: QrStatus; validUntil: Date | null }): QrStatus {
  if (qr.status === "DISABLED" || qr.status === "PENDING_PAYMENT") return qr.status;
  if (!qr.validUntil) return qr.status;
  const now = Date.now();
  const end = qr.validUntil.getTime();
  if (now <= end) return "ACTIVE";
  if (now <= end + GRACE_DAYS * DAY) return "GRACE";
  return "EXPIRED";
}

export const isUsable = (qr: { status: QrStatus; validUntil: Date | null }) => {
  const s = resolveStatus(qr);
  return s === "ACTIVE" || s === "GRACE";
};

export const isActive = (qr: { status: QrStatus; validUntil: Date | null }) =>
  qr.status === "ACTIVE" &&
  (qr.validUntil === null || Date.now() <= qr.validUntil.getTime());
