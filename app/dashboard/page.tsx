import Link from "next/link";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantStats, buildInsights } from "@/lib/analytics";
import { getQrPricePaise } from "@/lib/plans";
import { Empty, Stat } from "@/components/Shell";
import { QrRequestList } from "@/components/QrRequestComponents";
import { OwnerStampRequestsPanel } from "@/components/loyalty/OwnerStampRequestsPanel";

export const dynamic = "force-dynamic";

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
    <div className="space-y-7">
      <div className="border-b border-[#E8DFD1] pb-4">
        <h1 className="font-serif text-3xl font-bold text-[#24211E]">
          {greeting}, {user.name.split(" ")[0]}
        </h1>
        <p className="text-xs text-[#716B64] mt-0.5">
          Last 30 days overview at {restaurant.name}.
        </p>
      </div>

      {/* Real-time Customer Visit Stamp Requests Panel */}
      <OwnerStampRequestsPanel restaurantBrandColor="#B58A4B" />

      {serializedApprovedRequests.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-[#E8D8BA] bg-[#FAF5ED] p-5 shadow-subtle">
          <div>
            <h2 className="font-serif text-base font-bold text-[#7A5826]">Approved QR Requests</h2>
            <p className="mt-1 text-xs text-[#716B64]">
              Scan the payment QR. The administrator will verify payment and activate your QR codes.
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

      {qrCount === 0 ? (
        <Empty
          title="Setting up your QR codes"
          body="Your representative or administrator will activate your QR code shortly. Once ready, you can download it and start collecting customer reviews."
          href="/dashboard/qr"
          cta="View QR codes"
        />
      ) : s.scans === 0 ? (
        <Empty
          title="No scans yet"
          body="Print your QR code and place it where guests will see it. Scans and feedback show up here."
          href="/dashboard/qr"
          cta="Go to QR codes"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
            <Stat
              label="Average rating"
              value={s.avgOverall ? s.avgOverall.toFixed(1) : "–"}
              hint={`${s.sessions} responses`}
            />
            <Stat label="QR scans" value={s.scans} />
            <Stat label="Completed feedback" value={s.sessions} />
            <Stat label="Continued to Google" value={s.googleClicks} hint="Tapped to post on Google." />
            <Stat
              label="Social clicks"
              value={s.socialClicks}
              hint={
                s.socialClicks > 0
                  ? `${s.instagramClicks} Instagram · ${s.facebookClicks} Facebook`
                  : "Instagram or Facebook taps."
              }
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E8DFD1] bg-white p-6 shadow-subtle">
              <h2 className="font-serif text-base font-bold text-[#24211E]">Rating spread</h2>
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

            <div className="rounded-2xl border border-[#E8DFD1] bg-white p-6 shadow-subtle">
              <h2 className="font-serif text-base font-bold text-[#24211E]">What guests rate</h2>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-[#E8DFD1]/50 pb-2">
                  <dt className="text-[#716B64]">Food Rating</dt>
                  <dd className="font-serif font-bold text-base text-[#24211E]">
                    {s.avgFood ? s.avgFood.toFixed(1) : "–"}
                  </dd>
                </div>
                <div className="flex justify-between items-center border-b border-[#E8DFD1]/50 pb-2">
                  <dt className="text-[#716B64]">Service Rating</dt>
                  <dd className="font-serif font-bold text-base text-[#24211E]">
                    {s.avgService ? s.avgService.toFixed(1) : "–"}
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
