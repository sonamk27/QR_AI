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
          <h1 className="font-serif text-3xl font-bold text-[#24211E]">QR Code</h1>
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
          <div className="grid gap-4 xl:grid-cols-2">
            {qrs.map((q: any) => {
              const status = resolveStatus(q);
              const badge = STATUS_BADGE[status] || STATUS_BADGE.ACTIVE;
              const isActive = status === "ACTIVE" || status === "GRACE";
              const days = q.validUntil
                ? Math.ceil((q.validUntil.getTime() - Date.now()) / DAY)
                : 0;

              return (
                <article key={q.id} className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
                    <div className="flex h-36 w-36 shrink-0 items-center justify-center self-center rounded-2xl border border-[#E8DFD1] bg-[#FAF7F2] p-2 sm:self-start">
                      {isActive ? (
                        <img
                          src={`/api/qr/${q.id}/download?format=png&inline=1&size=320`}
                          alt={`QR code for ${q.name}`}
                          width={320}
                          height={320}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <p className="px-2 text-center text-xs leading-relaxed text-[#716B64]">
                          QR unavailable while this code is {badge.label.toLowerCase()}.
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words font-serif text-lg font-bold text-[#24211E]">{q.name}</h2>
                          <p className="mt-0.5 text-xs text-[#716B64]">
                            {[q.location, q.tableNo && `Table ${q.tableNo}`]
                              .filter(Boolean)
                              .join(" · ") || "Default placement"}
                          </p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                        <div className="rounded-xl bg-[#FAF7F2] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#716B64]">Scans</p>
                          <p className="mt-0.5 text-sm font-bold text-[#24211E]">{q._count.scans}</p>
                        </div>
                        <div className="rounded-xl bg-[#FAF7F2] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#716B64]">Reviews</p>
                          <p className="mt-0.5 text-sm font-bold text-[#24211E]">{q._count.sessions}</p>
                        </div>
                      </div>

                      <p className={`mt-3 text-xs font-semibold ${status === "EXPIRED" ? "text-[#A83B3B]" : days <= 30 ? "text-[#7A5826]" : "text-[#2E6B4F]"}`}>
                        {status === "DISABLED" || status === "PENDING_PAYMENT"
                          ? status === "PENDING_PAYMENT" ? "Payment required" : "Disabled"
                          : days > 0 ? `${days} days left` : `Expired ${Math.abs(days)} days ago`}
                        {q.validUntil && status !== "DISABLED" && status !== "PENDING_PAYMENT" && (
                          <span className="font-normal text-[#716B64]"> · until {q.validUntil.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 border-t border-[#E8DFD1] bg-[#FAF7F2]/60 p-3 sm:justify-end sm:px-5">
                    {isActive ? (
                      <>
                        <OpenQrButton
                          qrId={q.id}
                          name={q.name}
                          location={q.location}
                          tableNo={q.tableNo}
                          restaurantName={restaurant.name}
                          logoUrl={restaurant.logoUrl || "/logo.png"}
                          brandColor={restaurant.brandColor}
                          googleReviewUrl={restaurant.googleReviewUrl}
                          instagramUrl={restaurant.instagramUrl}
                          facebookUrl={restaurant.facebookUrl}
                          shareCaption={restaurant.shareCaption}
                        />
                        <Link
                          href={`/dashboard/qr/${q.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center rounded-xl bg-[#24211E] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3A3530]"
                        >
                          Print stand card
                        </Link>
                        <a
                          href={`/api/qr/${q.id}/download?format=png`}
                          download
                          className="inline-flex min-h-9 items-center rounded-xl border border-[#E8DFD1] bg-white px-3 py-2 text-xs font-semibold text-[#24211E] transition hover:bg-[#FAF7F2]"
                        >
                          Download PNG
                        </a>
                      </>
                    ) : (
                      <Link
                        href="/dashboard/qr-requests"
                        className="inline-flex min-h-9 items-center rounded-xl bg-[#B58A4B] px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438]"
                      >
                        Renew / activate
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
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
