import Link from "next/link";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { restaurantStats, buildInsights } from "@/lib/analytics";
import { getQrPricePaise } from "@/lib/plans";
import { Empty, Stat } from "@/components/Shell";
import { QrRequestList } from "@/components/QrRequestComponents";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{greeting}, {user.name.split(" ")[0]}</h1>
        <p className="text-ink/70">Last 30 days at {restaurant.name}.</p>
      </div>

      {serializedApprovedRequests.length > 0 && (
        <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5">
          <div>
            <h2 className="font-semibold text-blue-950">Approved QR requests</h2>
            <p className="mt-1 text-sm text-blue-800">
              Submit UTRs for manual UPI or bank transfers and access your activated QR codes.
            </p>
          </div>
          <QrRequestList
            requests={serializedApprovedRequests}
            allowTestPayment={process.env.NODE_ENV !== "production"}
            paymentUnitPaise={getQrPricePaise()}
            upiVpa={process.env.UPI_VPA?.trim() ?? ""}
            upiPayeeName={process.env.UPI_PAYEE_NAME?.trim() || "ReviewFlow"}
          />
          <Link
            href="/dashboard/payments"
            className="inline-flex text-sm font-medium text-blue-800 underline underline-offset-2"
          >
            View payment history and invoices
          </Link>
        </section>
      )}

      {qrCount === 0 ? (
        <Empty title="Setting up your QR codes" body="Your representative or administrator will activate your QR code shortly. Once ready, you can download it and start collecting customer reviews." href="/dashboard/qr" cta="View QR codes" />
      ) : s.scans === 0 ? (
        <Empty title="No scans yet" body="Print your QR code and place it where guests will see it. Scans and feedback show up here." href="/dashboard/qr" cta="Go to QR codes" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Average rating" value={s.avgOverall ? s.avgOverall.toFixed(1) : "–"} hint={`${s.sessions} responses`} />
            <Stat label="QR scans" value={s.scans} />
            <Stat label="Completed feedback" value={s.sessions} />
            <Stat label="Continued to Google" value={s.googleClicks} hint="Tapped the button. Not a count of posted reviews." />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <h2 className="font-semibold">Rating spread</h2>
              <div className="mt-3 space-y-2">
                {[...s.distribution].reverse().map((d) => (
                  <div key={d.rating} className="flex items-center gap-3 text-sm">
                    <span className="w-6">{d.rating}★</span>
                    <div className="h-2.5 flex-1 rounded bg-paper"><div className="h-2.5 rounded bg-leaf" style={{ width: `${(d.count / max) * 100}%` }} /></div>
                    <span className="w-8 text-right text-ink/60">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="font-semibold">What guests rate</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt>Food</dt><dd>{s.avgFood ? s.avgFood.toFixed(1) : "–"}</dd></div>
                <div className="flex justify-between"><dt>Service</dt><dd>{s.avgService ? s.avgService.toFixed(1) : "–"}</dd></div>
              </dl>
              {insights[0] && <p className="mt-4 border-t border-line pt-3 text-sm text-ink/80">{insights[0]} <Link className="underline" href="/dashboard/insights">More insights</Link></p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
