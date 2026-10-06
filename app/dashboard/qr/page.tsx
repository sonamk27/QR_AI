import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStatus } from "@/lib/qr-status";
import { Empty } from "@/components/Shell";
import { OpenQrButton } from "@/components/QrActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  GRACE: { label: "Grace period", className: "bg-amber-50 text-amber-700 border-amber-200" },
  EXPIRED: { label: "Expired", className: "bg-rose-50 text-rose-700 border-rose-200" },
  DISABLED: { label: "Disabled", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  PENDING_PAYMENT: { label: "Pending Payment", className: "bg-blue-50 text-blue-700 border-blue-200" },
};

export default async function QrPage() {
  const { restaurant } = (await getOwnerContext())!;
  const qrs = await db.qrCode.findMany({
    where: { restaurantId: restaurant.id, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scans: true, sessions: true } } },
  });

  const expiringSoonCount = qrs.filter((q) => {
    const status = resolveStatus(q);
    if (status !== "ACTIVE" && status !== "GRACE") return false;
    if (!q.validUntil) return false;
    const days = Math.ceil((q.validUntil.getTime() - Date.now()) / DAY);
    return days <= 30;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">QR codes</h1>
          <p className="mt-1 text-ink/70">
            Download and print your QR codes for table stands, billing counters, and takeaway menus.
          </p>
        </div>
        <Link href="/dashboard/qr-requests" className="btn whitespace-nowrap self-start">
          + Request New QR
        </Link>
      </div>

      {expiringSoonCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">⚠️ Renewal Notice:</span>
            <span>
              {expiringSoonCount} of your QR code{expiringSoonCount > 1 ? "s are" : " is"} expiring
              within 30 days or in grace period. Renew early to avoid service interruption!
            </span>
          </div>
          <Link
            href="/dashboard/qr-requests"
            className="btn !bg-amber-600 hover:!bg-amber-700 whitespace-nowrap text-xs"
          >
            Renew QR Codes
          </Link>
        </div>
      )}

      {qrs.length === 0 ? (
        <Empty
          title="No QR codes assigned yet"
          body="Submit a QR request and once approved and payment is complete, your QR codes will appear here."
          href="/dashboard/qr-requests"
          cta="Request a QR code"
        />
      ) : (
        <div className="space-y-6">
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="th">Name &amp; Placement</th>
                  <th className="th">Status</th>
                  <th className="th">Validity &amp; Countdown</th>
                  <th className="th">Scans</th>
                  <th className="th">Reviews</th>
                  <th className="th">Download &amp; Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {qrs.map((q) => {
                  const status = resolveStatus(q);
                  const badge = STATUS_BADGE[status] || STATUS_BADGE.ACTIVE;
                  const isActive = status === "ACTIVE" || status === "GRACE";

                  const days = q.validUntil
                    ? Math.ceil((q.validUntil.getTime() - Date.now()) / DAY)
                    : 0;

                  return (
                    <tr key={q.id} className="hover:bg-paper/40 transition">
                      <td className="td">
                        <p className="font-semibold text-ink">{q.name}</p>
                        <p className="text-xs text-ink/60">
                          {[q.location, q.tableNo && `Table ${q.tableNo}`]
                            .filter(Boolean)
                            .join(" • ") || "Default"}
                        </p>
                      </td>
                      <td className="td">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="td text-xs">
                        {status === "DISABLED" || status === "PENDING_PAYMENT" ? (
                          <span className="text-ink/40">–</span>
                        ) : days > 30 ? (
                          <div>
                            <span className="font-semibold text-emerald-700">{days} days left</span>
                            <p className="text-[11px] text-ink/50">
                              Valid until {q.validUntil?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </p>
                          </div>
                        ) : days > 0 ? (
                          <div>
                            <span className="font-semibold text-amber-700">⚠️ {days} days left</span>
                            <p className="text-[11px] text-ink/50">
                              Valid until {q.validUntil?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-rose-700">Expired {Math.abs(days)}d ago</span>
                            <p className="text-[11px] text-ink/50">
                              Ended {q.validUntil?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="td text-sm font-medium">{q._count.scans}</td>
                      <td className="td text-sm font-medium">{q._count.sessions}</td>
                      <td className="td">
                        {isActive ? (
                          <OpenQrButton qrId={q.id} name={q.name} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink/50">
                              {status === "PENDING_PAYMENT"
                                ? "Payment required"
                                : "Expired/Disabled"}
                            </span>
                            <Link
                              href="/dashboard/qr-requests"
                              className="btn !px-2.5 !py-1 text-xs"
                            >
                              Renew / Activate
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-line bg-paper/60 p-4 text-sm text-ink/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">Need more table QRs or standees?</p>
              <p className="text-xs text-ink/70">
                Submit a QR request and activate multiple stands for your billing counters, patio, or bar.
              </p>
            </div>
            <Link href="/dashboard/qr-requests" className="btn whitespace-nowrap">
              Request QR code
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
