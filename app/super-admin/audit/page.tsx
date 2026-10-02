import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuditLogAdminTable } from "@/components/AuditLogAdminTable";

export const dynamic = "force-dynamic";

export default async function SuperAdminAuditPage() {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
  });
  const actorIds = Array.from(new Set(logs.map((log) => log.actorId).filter((id) => id !== "webhook")));
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

  const serialized = logs.map((l) => ({
    id: l.id,
    actorId: l.actorId,
    action: l.action,
    target: l.target,
    meta: l.meta,
    createdAt: l.createdAt.toISOString(),
    actorName: l.actorId === "webhook" ? "System webhook" : actorsById.get(l.actorId)?.name ?? "Unknown actor",
    actorEmail: actorsById.get(l.actorId)?.email ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Platform Audit Log</h1>
          <p className="mt-1 text-sm text-ink/70">
            Immutable log of administrative operations, QR changes, status modifications, and security events.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-center">
          <span className="text-ink/60 block">Logged Events</span>
          <span className="font-semibold text-ink">{logs.length}</span>
        </div>
      </div>

      <AuditLogAdminTable logs={serialized} />
    </div>
  );
}
