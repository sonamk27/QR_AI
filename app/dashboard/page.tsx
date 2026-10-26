import Link from "next/link";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantStats, buildInsights } from "@/lib/analytics";
import { getQrPricePaise } from "@/lib/plans";
import { QrRequestList } from "@/components/QrRequestComponents";
import { OwnerStampRequestsPanel } from "@/components/loyalty/OwnerStampRequestsPanel";

export const dynamic = "force-dynamic";

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#716B64]">{label}</p>
      <p className="mt-3 font-serif text-3xl font-bold leading-none text-[#24211E]">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#716B64]">{detail}</p>
    </article>
  );
}

export default async function Overview() {
  const { restaurant, user } = (await getOwnerContext())!;
  const [qrCount, s, approvedRequests] = await Promise.all([
    db.qrCode.count({ where: { restaurantId: restaurant.id } }),
    restaurantStats(restaurant.id, 30),
    db.qrRequest.findMany({
      where: {
        restaurant: { ownerId: user.id },
        status: { in: ["APPROVED_PAYMENT_DUE", "PAID", "ACTIVE"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: { select: { name: true } },
        qrCodes: { select: { id: true, slug: true, status: true } },
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
            method: true,
            reference: true,
          },
        },
      },
    }),
  ]);
  const serializedApprovedRequests = approvedRequests.map((request) => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  }));
  const insights = buildInsights(s);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const max = Math.max(1, ...s.distribution.map((d) => d.count));

  return (
    <div className="space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-4 border-b border-[#E8DFD1] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A7441]">Restaurant overview · Last 30 days</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#24211E] sm:text-3xl">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-[#716B64]">Here’s how {restaurant.name} is doing.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Link href="/dashboard/feedback" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E8DFD1] bg-white px-3.5 text-xs font-semibold text-[#24211E] transition hover:bg-[#FAF7F2]">
            View feedback
          </Link>
          <Link href="/dashboard/qr" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B58A4B] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438]">
            Manage QR codes
          </Link>
        </div>
      </header>

      {/* Real-time Customer Visit Stamp Requests Panel */}
      <OwnerStampRequestsPanel restaurantBrandColor="#B58A4B" />

      {serializedApprovedRequests.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-[#E8D8BA] bg-[#FAF5ED] p-5 shadow-subtle">
          <div>
            <h2 className="font-serif text-base font-bold text-[#7A5826]">QR request updates</h2>
            <p className="mt-1 text-xs text-[#716B64]">
              Check approval, payment, and activation status for your requests.
            </p>
          </div>
          <QrRequestList
            requests={serializedApprovedRequests}
            allowTestPayment={process.env.NODE_ENV !== "production"}
            paymentUnitPaise={getQrPricePaise()}
          />
          <Link
            href="/dashboard/payments"
            className="inline-flex text-xs font-bold text-[#B58A4B] underline underline-offset-2 hover:text-[#9E7438]"
          >
            View payment history and invoices →
          </Link>
        </section>
      )}

      <section aria-label="Last 30 days metrics" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Average rating" value={s.avgOverall != null ? s.avgOverall.toFixed(1) : "—"} detail={`${s.sessions} guest responses`} />
        <MetricCard label="QR scans" value={s.scans} detail="Guest visits from your QR codes" />
        <MetricCard label="Feedback" value={s.sessions} detail="Completed guest responses" />
        <MetricCard label="Google visits" value={s.googleClicks} detail="Guests who continued to Google" />
        <MetricCard label="Social visits" value={s.socialClicks} detail={`${s.instagramClicks} Instagram · ${s.facebookClicks} Facebook`} />
      </section>

      {s.sessions === 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-subtle sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9A7441]">Getting started</p>
            <h2 className="mt-1 font-serif text-xl font-bold text-[#24211E]">
              {qrCount === 0 ? "Get your first QR code" : s.scans === 0 ? "Put your QR code to work" : "Your guest feedback will appear here"}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#716B64]">
              {qrCount === 0
                ? "Request a QR code for your restaurant. Once it’s approved and active, you can download and place it for guests."
                : s.scans === 0
                  ? "Download or print your QR code and place it where guests can easily scan it."
                  : `${s.scans} guests have scanned your QR code. Completed feedback and ratings will appear here.`}
            </p>
          </div>
          <Link
            href={qrCount === 0 ? "/dashboard/qr-requests" : "/dashboard/qr"}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#B58A4B] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438]"
          >
            {qrCount === 0 ? "Request a QR code" : "Open QR management"}
          </Link>
        </section>
      ) : (
        <>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6">
              <h2 className="font-serif text-base font-bold text-[#24211E]">Rating spread</h2>
              <p className="mt-0.5 text-xs text-[#716B64]">Guest responses by star rating</p>
              <div className="mt-4 space-y-2.5">
                {[...s.distribution].reverse().map((d) => (
                  <div key={d.rating} className="flex items-center gap-3 text-xs">
                    <span className="w-6 font-semibold text-[#24211E]">{d.rating}★</span>
                    <div className="h-2.5 flex-1 rounded-full bg-[#FAF7F2] border border-[#E8DFD1]/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#B58A4B]"
                        style={{ width: `${(d.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-[#716B64]">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6">
              <h2 className="font-serif text-base font-bold text-[#24211E]">What guests rate</h2>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-[#E8DFD1]/50 pb-2">
                  <dt className="text-[#716B64]">Food Rating</dt>
                  <dd className="font-serif font-bold text-base text-[#24211E]">
                    {s.avgFood != null ? s.avgFood.toFixed(1) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between items-center border-b border-[#E8DFD1]/50 pb-2">
                  <dt className="text-[#716B64]">Service Rating</dt>
                  <dd className="font-serif font-bold text-base text-[#24211E]">
                    {s.avgService != null ? s.avgService.toFixed(1) : "—"}
                  </dd>
                </div>
              </dl>
              {insights[0] && (
                <p className="mt-4 border-t border-[#E8DFD1]/60 pt-3 text-xs text-[#716B64] leading-relaxed">
                  {insights[0]}{" "}
                  <Link className="font-bold text-[#B58A4B] underline" href="/dashboard/insights">
                    More insights →
                  </Link>
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
