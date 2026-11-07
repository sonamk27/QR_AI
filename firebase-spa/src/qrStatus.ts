const DAY = 86_400_000;
export const QR_GRACE_DAYS = 7;

export type QrStatus = "ACTIVE" | "GRACE" | "EXPIRED" | "DISABLED" | "PENDING_PAYMENT";

export function resolveQrStatus(status: string, validUntil: Date | null, now = Date.now()): QrStatus {
  if (status === "DISABLED" || status === "PENDING_PAYMENT" || status === "EXPIRED") return status;
  if (status !== "ACTIVE" && status !== "GRACE") return "DISABLED";
  if (!validUntil) return status;
  const end = validUntil.getTime();
  if (now <= end) return "ACTIVE";
  if (now <= end + QR_GRACE_DAYS * DAY) return "GRACE";
  return "EXPIRED";
}
