import { redirect } from "next/navigation";
import Link from "next/link";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { platformStats } from "@/lib/analytics";
import { rupees } from "@/lib/plans";
import { Stat } from "@/components/Shell";
import { CreateRestaurantModal } from "@/components/SuperAdminModals";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverview() {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    stats,
    newRestaurantsThisMonth,
    pendingRequestsCount,
    recentRequests,
    recentRestaurants,
    recentAuditLogs,
  ] = await Promise.all([
    platformStats(),
    db.restaurant.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.qrRequest.count({ where: { status: "PENDING_APPROVAL" } }),
    db.qrRequest.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        restaurant: {
          select: { name: true, city: true, owner: { select: { name: true, email: true } } },
        },
      },
    }),
    db.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { qrCodes: true } },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const auditActorIds = Array.from(
    new Set(recentAuditLogs.map((log) => log.actorId).filter((id) => id !== "webhook")),
  );
  const auditActors = auditActorIds.length
    ? await db.user.findMany({
        where: { id: { in: auditActorIds } },
        select: { id: true, name: true },
      })
    : [];
  const auditActorNames = new Map(auditActors.map((actor) => [actor.id, actor.name]));

  return (
    <div className="space-y-8">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Platform Overview</h1>
          <p className="mt-1 text-sm text-ink/70">
            High-level metrics, pending review requests, and quick administrative actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateRestaurantModal />
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Active Restaurants"
          value={stats.activeRestaurants}
          hint={`+${newRestaurantsThisMonth} onboarded this month`}
        />
        <Stat
          label="Pending Requests"
          value={pendingRequestsCount}
          hint="Awaiting your review"
        />
        <Stat
          label="Active QR Codes"
          value={stats.qrActive}
          hint={`${stats.qrExpired} in grace or expired`}
        />
        <Stat
          label="Total Revenue"
          value={rupees(stats.revenue)}
          hint="Verified direct + gateway payments"
        />
        <Stat
          label="QRs Expiring Soon"
          value={stats.qrExpiringSoon}
          hint="Due within 30 days"
        />
        <Stat
          label="Customer Scans"
          value={stats.scans}
          hint={`${stats.sessions} feedback, ${stats.clicks} Google clicks`}
        />
      </div>

      {/* Pending QR Requests Banner if any */}
      {pendingRequestsCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-white text-sm">
                !
              </span>
              <div>
                <h3 className="font-semibold text-amber-950">
                  {pendingRequestsCount} Pending QR Request{pendingRequestsCount > 1 ? "s" : ""}
                </h3>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  Restaurants are waiting for your review. QR codes are generated only after payment is confirmed.
                </p>
              </div>
            </div>
            <Link
              href="/super-admin/qr-requests"
              className="btn whitespace-nowrap !bg-amber-600 hover:!bg-amber-700 text-xs"
            >
              Review Requests →
            </Link>
          </div>

          <div className="mt-4 divide-y divide-amber-200/60 border-t border-amber-200/60 pt-2">
            {recentRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <span className="font-medium text-amber-950">{req.restaurant.name}</span>
                  <span className="text-amber-800/80 ml-2">
                    requested &ldquo;{req.name}&rdquo; ({req.quantity} QR{req.quantity > 1 ? "s" : ""})
                  </span>
                </div>
                <span className="text-amber-800/60 font-mono">
                  {req.createdAt.toLocaleDateString("en-IN", { dateStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/super-admin/restaurants"
          className="panel p-5 transition hover:border-leaf hover:shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink group-hover:text-leaf">Manage Restaurants</h3>
            <span className="text-xs text-leaf font-medium">View all →</span>
          </div>
          <p className="mt-1 text-xs text-ink/60">
            {stats.restaurants} registered restaurants with owners &amp; sales attribution.
          </p>
          <div className="mt-4 space-y-1.5 border-t border-line pt-3">
            {recentRestaurants.slice(0, 3).map((r) => (
              <div key={r.id} className="flex justify-between text-xs text-ink/70">
                <span className="font-medium truncate max-w-[160px]">{r.name}</span>
                <span>{r._count.qrCodes} QRs</span>
              </div>
            ))}
          </div>
        </Link>

        <Link
          href="/super-admin/qr-codes"
          className="panel p-5 transition hover:border-leaf hover:shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink group-hover:text-leaf">QR Code Fleet</h3>
            <span className="text-xs text-leaf font-medium">View all →</span>
          </div>
          <p className="mt-1 text-xs text-ink/60">
            {stats.qrActive} active QR codes. Renew, enable/disable, and download print assets.
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink/70">
            <span>Grace/Expired: {stats.qrExpired}</span>
            <span>Total Scans: {stats.scans}</span>
          </div>
        </Link>

        <Link
          href="/super-admin/payments"
          className="panel p-5 transition hover:border-leaf hover:shadow-sm group sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink group-hover:text-leaf">Payment Ledger</h3>
            <span className="text-xs text-leaf font-medium">View ledger →</span>
          </div>
          <p className="mt-1 text-xs text-ink/60">
            All direct UPI, Cash, Bank, and Gateway payments with invoice records.
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink/70">
            <span>Verified Total</span>
            <span className="font-semibold text-leaf">{rupees(stats.revenue)}</span>
          </div>
        </Link>
      </div>

      {/* Mini Audit Log Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Recent Audit Log</h2>
            <p className="text-xs text-ink/60">Latest 10 actions recorded across the system.</p>
          </div>
          <Link href="/super-admin/audit" className="text-xs font-medium text-leaf hover:underline">
            Full Audit Log →
          </Link>
        </div>

        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr>
                <th className="th">Action</th>
                <th className="th">Target</th>
                <th className="th">Actor</th>
                <th className="th">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="td text-center text-ink/60 py-6">
                    No actions logged yet.
                  </td>
                </tr>
              ) : (
                recentAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="td font-mono text-xs font-medium text-ink">{log.action}</td>
                    <td className="td font-mono text-xs text-ink/60">{log.target ?? "—"}</td>
                    <td className="td text-xs text-ink/60">
                      {log.actorId === "webhook"
                        ? "System webhook"
                        : auditActorNames.get(log.actorId) || "Unknown actor"}
                    </td>
                    <td className="td text-xs text-ink/60">
                      {log.createdAt.toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
