import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStatus } from "@/lib/qr-status";
import { appBaseUrl } from "@/lib/qr";
import { QrCodesAdminTable } from "@/components/QrCodesAdminTable";

export const dynamic = "force-dynamic";

export default async function SuperAdminQrCodesPage() {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  const [qrCodes, restaurants] = await Promise.all([
    db.qrCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            city: true,
            owner: { select: { name: true, email: true } },
          },
        },
        _count: { select: { scans: true, sessions: true } },
      },
    }),
    db.restaurant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        owner: { select: { name: true, email: true } },
      },
    }),
  ]);

  const appUrl = appBaseUrl();

  const serialized = qrCodes.map((q) => ({
    id: q.id,
    name: q.name,
    location: q.location,
    tableNo: q.tableNo,
    slug: q.slug,
    status: q.status,
    resolvedStatus: resolveStatus(q),
    validUntil: q.validUntil ? q.validUntil.toISOString() : null,
    createdAt: q.createdAt.toISOString(),
    restaurant: q.restaurant,
    _count: q._count,
  }));

  const activeCount = serialized.filter((q) => q.resolvedStatus === "ACTIVE").length;
  const graceCount = serialized.filter((q) => q.resolvedStatus === "GRACE").length;
  const expiredCount = serialized.filter((q) => q.resolvedStatus === "EXPIRED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">QR Codes Fleet</h1>
          <p className="mt-1 text-sm text-ink/70">
            Monitor all customer-facing QR codes, handle yearly renewals, and manage access.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-lg border border-line bg-white px-3 py-1.5 text-center">
            <span className="text-ink/60 block">Total QRs</span>
            <span className="font-semibold text-ink">{qrCodes.length}</span>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center">
            <span className="text-emerald-800/70 block">Active</span>
            <span className="font-semibold text-emerald-900">{activeCount}</span>
          </div>
          {graceCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-center">
              <span className="text-amber-800/70 block">Grace</span>
              <span className="font-semibold text-amber-900">{graceCount}</span>
            </div>
          )}
          {expiredCount > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-center">
              <span className="text-rose-800/70 block">Expired</span>
              <span className="font-semibold text-rose-900">{expiredCount}</span>
            </div>
          )}
        </div>
      </div>

      <QrCodesAdminTable
        qrCodes={serialized}
        restaurants={restaurants}
        appUrl={appUrl}
      />
    </div>
  );
}
