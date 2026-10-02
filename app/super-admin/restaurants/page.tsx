import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { RestaurantsAdminTable } from "@/components/RestaurantsAdminTable";

export const dynamic = "force-dynamic";

export default async function SuperAdminRestaurantsPage() {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  const restaurants = await db.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { qrCodes: true } },
    },
  });

  const serialized = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    brandColor: r.brandColor,
    status: r.status,
    referredByName: r.referredByName,
    createdAt: r.createdAt.toISOString(),
    owner: r.owner,
    _count: r._count,
  }));

  const activeCount = restaurants.filter((r) => r.status === "ACTIVE").length;
  const suspendedCount = restaurants.filter((r) => r.status === "SUSPENDED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Restaurants &amp; Owners</h1>
          <p className="mt-1 text-sm text-ink/70">
            View all onboarded restaurants, manage account statuses, and track partner attribution.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-lg border border-line bg-white px-3 py-1.5 text-center">
            <span className="text-ink/60 block">Total</span>
            <span className="font-semibold text-ink">{restaurants.length}</span>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center">
            <span className="text-emerald-800/70 block">Active</span>
            <span className="font-semibold text-emerald-900">{activeCount}</span>
          </div>
          {suspendedCount > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-center">
              <span className="text-rose-800/70 block">Suspended</span>
              <span className="font-semibold text-rose-900">{suspendedCount}</span>
            </div>
          )}
        </div>
      </div>

      <RestaurantsAdminTable restaurants={serialized} />
    </div>
  );
}
