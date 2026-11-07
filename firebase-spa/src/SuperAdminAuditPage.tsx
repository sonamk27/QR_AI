import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { AuditLogAdminTable } from "../../components/AuditLogAdminTable";
import { getFirebaseServices } from "./firebase";
import { getBusinessType, type BusinessType } from "../../lib/business-type";

type LogRow = { id: string; actorId: string; action: string; target: string | null; businessType: BusinessType | null; meta: unknown; createdAt: string; actorName: string; actorEmail: string | null };
export default function SuperAdminAuditPage() {
  const [logs, setLogs] = useState<LogRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { void (async () => { try {
    const { db } = getFirebaseServices(); const [logSnap, userSnap, restaurantSnap] = await Promise.all([
      getDocs(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(500))), getDocs(collection(db, "users")), getDocs(collection(db, "restaurants")),
    ]);
    const users = new Map(userSnap.docs.map((d) => [d.id, d.data()]));
    const restaurants = new Map(restaurantSnap.docs.map((d) => [d.id, d.data()]));
    setLogs(logSnap.docs.map((d) => { const row = d.data(); const actorId = String(row.actorUid ?? ""); const actor = users.get(actorId); const restaurant = typeof row.restaurantId === "string" ? restaurants.get(row.restaurantId) : undefined; return {
      id: d.id, actorId, action: String(row.action ?? ""), target: row.target == null ? null : String(row.target), meta: row.meta ?? null,
      businessType: restaurant ? getBusinessType(restaurant.businessType) : null,
      createdAt: row.createdAt?.toDate?.().toISOString?.() ?? new Date(0).toISOString(), actorName: actorId === "webhook" ? "System webhook" : String(actor?.name ?? "Unknown actor"), actorEmail: actor?.email ?? null,
    }; }));
  } catch (e) { console.error("Audit log could not be loaded", e); setError("Could not load audit entries from Firestore. Check your access rules."); }
  finally { setLoading(false); } })(); }, []);
  return <div className="space-y-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="font-serif text-3xl font-bold tracking-tight text-[#24211E]">Platform Audit Log</h1><p className="mt-1 text-sm text-[#716B64]">Immutable record of administrative operations, QR changes, and security events.</p></div><div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center text-xs"><span className="block text-[#716B64]">Logged Events</span><span className="font-bold text-[#24211E]">{logs.length}</span></div></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{loading ? <p className="text-sm text-[#716B64]">Loading audit log…</p> : <AuditLogAdminTable logs={logs} />}</div>;
}
