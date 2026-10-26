import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStatus } from "@/lib/qr-status";
import { Empty } from "@/components/Shell";
import { OpenQrButton } from "@/components/QrActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-[#EEF6F2] text-[#2E6B4F] border-[#D1E7DC]" },
  GRACE: { label: "Grace period", className: "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]" },
  EXPIRED: { label: "Expired", className: "bg-[#FDF2F2] text-[#A83B3B] border-[#F7D6D6]" },
  DISABLED: { label: "Disabled", className: "bg-[#FAF7F2] text-[#716B64] border-[#E8DFD1]" },
  PENDING_PAYMENT: { label: "Pending Payment", className: "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]" },
};

export default async function QrPage() {
  const { restaurant } = (await getOwnerContext())!;
  const qrs = await db.qrCode.findMany({
    where: { restaurantId: restaurant.id, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scans: true, sessions: true } } },
  });

  const expiringSoonCount = qrs.filter((q: any) => {
    const status = resolveStatus(q);
    if (status !== "ACTIVE" && status !== "GRACE") return false;
    if (!q.validUntil) return false;
    const days = Math.ceil((q.validUntil.getTime() - Date.now()) / DAY);
    return days <= 30;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8DFD1] pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#24211E]">QR Code Management</h1>
          <p className="mt-1 text-xs text-[#716B64]">
            Download high-res QR codes and print branded table tent cards for tables, billing counters, and bars.
          </p>
        </div>
        <Link
          href="/dashboard/qr-requests"
          className="rounded-2xl bg-[#B58A4B] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition whitespace-nowrap self-start"
        >
          + Request New QR
        </Link>
      </div>

      {expiringSoonCount > 0 && (
        <div className="rounded-2xl border border-[#E8D8BA] bg-[#FAF5ED] p-4 text-xs text-[#7A5826] flex items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">⚠️ Renewal Notice:</span>
            <span>
              {expiringSoonCount} of your QR code{expiringSoonCount > 1 ? "s are" : " is"} expiring
              within 30 days or in grace period. Renew early to avoid service interruption!
            </span>
          </div>
          <Link
            href="/dashboard/qr-requests"
            className="rounded-xl bg-[#B58A4B] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] whitespace-nowrap"
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
          <div className="rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8DFD1] bg-[#FAF7F2] text-[10px] font-bold text-[#716B64] uppercase tracking-wider">
                  <th className="px-4 py-3">Name &amp; Placement</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3">Scans</th>
                  <th className="px-4 py-3">Reviews</th>
                  <th className="px-4 py-3 text-right">Download &amp; Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD1]/50">
                {qrs.map((q: any) => {
                  const status = resolveStatus(q);
                  const badge = STATUS_BADGE[status] || STATUS_BADGE.ACTIVE;
                  const isActive = status === "ACTIVE" || status === "GRACE";

                  const days = q.validUntil
                    ? Math.ceil((q.validUntil.getTime() - Date.now()) / DAY)
                    : 0;

                  return (
                    <tr key={q.id} className="hover:bg-[#FAF7F2] transition">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[#24211E]">{q.name}</p>
                        <p className="text-[11px] text-[#716B64]">
                          {[q.location, q.tableNo && `Table ${q.tableNo}`]
                            .filter(Boolean)
                            .join(" • ") || "Default"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {status === "DISABLED" || status === "PENDING_PAYMENT" ? (
                          <span className="text-[#716B64]/50">–</span>
                        ) : days > 30 ? (
                          <div>
                            <span className="font-semibold text-[#2E6B4F]">{days} days left</span>
                            <p className="text-[10px] text-[#716B64]">
                              Valid until {q.validUntil?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </p>
                          </div>
                        ) : days > 0 ? (
                          <div>
                            <span className="font-semibold text-[#7A5826]">⚠️ {days} days left</span>
                            <p className="text-[10px] text-[#716B64]">
                              Valid until {q.validUntil?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-[#A83B3B]">Expired {Math.abs(days)}d ago</span>
                            <p className="text-[10px] text-[#716B64]">
                              Ended {q.validUntil?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[#24211E]">{q._count.scans}</td>
                      <td className="px-4 py-3.5 font-medium text-[#24211E]">{q._count.sessions}</td>
                      <td className="px-4 py-3.5 text-right">
                        {isActive ? (
                          <div className="flex items-center justify-end gap-2">
                            <OpenQrButton
                              qrId={q.id}
                              name={q.name}
                              location={q.location}
                              tableNo={q.tableNo}
                              restaurantName={restaurant.name}
                              logoUrl={restaurant.logoUrl}
                              brandColor={restaurant.brandColor}
                              googleReviewUrl={restaurant.googleReviewUrl}
                              instagramUrl={restaurant.instagramUrl}
                              facebookUrl={restaurant.facebookUrl}
                              shareCaption={restaurant.shareCaption}
                            />
                            <Link
                              href={`/dashboard/qr/${q.id}/print`}
                              target="_blank"
                              className="rounded-xl border border-[#E8DFD1] bg-white px-2.5 py-1 text-xs font-semibold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition whitespace-nowrap flex items-center gap-1"
                              title="Print Table Tent Card"
                            >
                              <span>🖨️</span>
                              <span>Print Card</span>
                            </Link>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] text-[#716B64]">
                              {status === "PENDING_PAYMENT"
                                ? "Payment required"
                                : "Expired/Disabled"}
                            </span>
                            <Link
                              href="/dashboard/qr-requests"
                              className="rounded-xl bg-[#B58A4B] px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-[#9E7438]"
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

          <div className="rounded-2xl border border-[#E8DFD1] bg-[#FAF7F2] p-5 text-xs text-[#716B64] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <p className="font-serif font-bold text-sm text-[#24211E]">Need more table QRs or standees?</p>
              <p className="text-xs text-[#716B64] mt-0.5">
                Submit a QR request and activate multiple stands for your billing counters, patio, or bar.
              </p>
            </div>
            <Link
              href="/dashboard/qr-requests"
              className="rounded-2xl bg-[#B58A4B] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition whitespace-nowrap"
            >
              Request QR Code
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
