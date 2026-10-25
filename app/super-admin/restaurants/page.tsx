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
    aiEnabled: r.aiEnabled,
    referredByName: r.referredByName,
    googleReviewUrl: r.googleReviewUrl,
    instagramUrl: (r as unknown as { instagramUrl?: string | null }).instagramUrl ?? null,
    facebookUrl: (r as unknown as { facebookUrl?: string | null }).facebookUrl ?? null,
    shareCaption: (r as unknown as { shareCaption?: string | null }).shareCaption ?? null,
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
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#24211E]">Restaurants &amp; Owners</h1>
          <p className="mt-1 text-sm text-[#716B64]">
            Manage restaurant accounts, review submitted Google Business Profile URLs, and partner attribution.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Total</span>
            <span className="font-bold text-[#24211E]">{restaurants.length}</span>
          </div>
          <div className="rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#B58A4B] block font-medium">Active</span>
            <span className="font-bold text-[#B58A4B]">{activeCount}</span>
          </div>
          {suspendedCount > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-center shadow-xs">
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
