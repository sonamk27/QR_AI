import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import QRCode from "qrcode";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import type { DashboardOutletContext } from "./DashboardShell";
import { getFirebaseServices } from "./firebase";
import { useAuthState } from "./AuthState";
import { resolveQrStatus } from "./qrStatus";

type QrRow = { id: string; name: string; slug: string; status: string; location?: string; tableNo?: string; validUntil?: { toDate: () => Date } | null; scans: number; sessions: number };
const DAY = 86_400_000;
const badges: Record<string, string> = { ACTIVE: "bg-[#EEF6F2] text-[#2E6B4F] border-[#D1E7DC]", GRACE: "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]", EXPIRED: "bg-[#FDF2F2] text-[#A83B3B] border-[#F7D6D6]", DISABLED: "bg-[#FAF7F2] text-[#716B64] border-[#E8DFD1]", PENDING_PAYMENT: "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]" };

export default function QrManagementPage() {
  const { user } = useAuthState();
  const { restaurant } = useOutletContext<DashboardOutletContext>();
  const [rows, setRows] = useState<QrRow[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const db = getFirebaseServices().db;
        const qrs = await getDocs(query(collection(db, "qrCodes"), where("ownerUid", "==", user.uid)));
        const qrRows = qrs.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? "QR code"), slug: String(d.data().slug ?? ""), status: String(d.data().status ?? "DISABLED"), location: d.data().location, tableNo: d.data().tableNo, validUntil: d.data().validUntil ?? null }));
        const result = await Promise.all(qrRows.map(async (row) => {
          const [scanCount, sessionCount] = await Promise.all([
            getCountFromServer(query(collection(db, "scans"), where("ownerUid", "==", user.uid), where("qrId", "==", row.id))),
            getCountFromServer(query(collection(db, "feedbackSessions"), where("ownerUid", "==", user.uid), where("qrId", "==", row.id))),
          ]);
          return { ...row, scans: scanCount.data().count, sessions: sessionCount.data().count };
        })).then((rows) => rows.sort((a, b) => a.name.localeCompare(b.name)));
        setRows(result);
        const origin = window.location.origin;
        const generated = await Promise.all(result.filter((r) => ["ACTIVE", "GRACE", "PENDING_PAYMENT"].includes(r.status)).map(async (r) => [r.id, await QRCode.toDataURL(`${origin}/r/${r.slug}`, { width: 512, margin: 2 })] as const));
        setImages(Object.fromEntries(generated));
      } catch (e) { console.error("QR codes could not be loaded", e); setError("Could not load QR codes. Check your Firestore rules."); }
      finally { setLoading(false); }
    })();
  }, [user]);
  const expiring = rows.filter((r) => { if (!r.validUntil || resolveQrStatus(r.status, r.validUntil.toDate()) !== "ACTIVE") return false; const days = Math.ceil((r.validUntil.toDate().getTime() - Date.now()) / DAY); return days >= 0 && days <= 30; }).length;
  const renewalEmail = `mailto:billing@reviewflow.in?subject=${encodeURIComponent(`QR license renewal for ${restaurant?.name ?? "my restaurant"}`)}&body=${encodeURIComponent(`Please help renew the QR license for ${restaurant?.name ?? "my restaurant"}.`)}`;
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 border-b border-[#E8DFD1] pb-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="font-serif text-3xl font-bold text-[#24211E]">QR Code</h1><p className="mt-1 text-xs text-[#716B64]">Preview every QR here. New codes stay locked until payment is approved, then become ready to use.</p></div>{restaurant?.primaryQrId ? <a href={renewalEmail} className="self-start whitespace-nowrap rounded-2xl bg-[#B58A4B] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438]">Request QR Renewal</a> : <Link to="/dashboard/qr-requests" className="self-start whitespace-nowrap rounded-2xl bg-[#B58A4B] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438]">+ Request New QR</Link>}</div>
    {expiring > 0 && <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E8D8BA] bg-[#FAF5ED] p-4 text-xs text-[#7A5826] shadow-subtle"><span><b className="text-sm">⚠️ Renewal Notice:</b> {expiring} QR code{expiring === 1 ? " is" : "s are"} expiring within 30 days or in grace period. Renew early to avoid service interruption!</span><a href={renewalEmail} className="whitespace-nowrap rounded-xl bg-[#B58A4B] px-3.5 py-1.5 font-bold text-white">Renew QR Codes</a></div>}
    {loading && <p className="text-sm text-[#716B64]">Loading QR codes…</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && rows.length === 0 && <div className="rounded-2xl border border-[#E8DFD1] bg-white p-8 text-center"><h2 className="font-serif text-xl font-bold">No QR codes generated yet</h2><p className="mt-2 text-sm text-[#716B64]">Submit a QR request to generate your QR. It will appear here locked while approval and payment are pending.</p><Link to="/dashboard/qr-requests" className="mt-4 inline-flex rounded-xl bg-[#B58A4B] px-4 py-2 text-xs font-bold text-white">Request a QR code</Link></div>}
    <div className="grid gap-4 xl:grid-cols-2">{rows.map((r) => {
      const until = r.validUntil?.toDate(); const status = resolveQrStatus(r.status, until ?? null); const active = status === "ACTIVE" || status === "GRACE"; const days = until ? Math.ceil((until.getTime() - Date.now()) / DAY) : 0;
      return <article key={r.id} className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle"><div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5"><div className="relative flex h-52 w-52 shrink-0 items-center justify-center self-center overflow-hidden rounded-2xl border border-[#E8DFD1] bg-[#FAF7F2] p-2 sm:h-56 sm:w-56 sm:self-start">{images[r.id] ? <img src={images[r.id]} alt={`QR code for ${r.name}`} className={`h-full w-full object-contain ${status === "PENDING_PAYMENT" ? "blur-[2px] opacity-50" : ""}`} /> : <p className="px-2 text-center text-xs text-[#716B64]">QR unavailable while this code is {status.toLowerCase()}.</p>}{status === "PENDING_PAYMENT" && <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/45 text-center"><span className="text-2xl">🔒</span><span className="mt-2 rounded-full bg-[#24211E]/90 px-3 py-1 text-[10px] font-bold uppercase text-white">Locked · payment pending</span></div>}</div><div className="min-w-0 flex-1 text-center sm:text-left"><div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-serif text-lg font-bold">{r.name}</h2><p className="mt-0.5 text-xs text-[#716B64]">{[r.location, r.tableNo && `Table ${r.tableNo}`].filter(Boolean).join(" · ") || "Default placement"}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${badges[status] ?? badges.DISABLED}`}>{status === "GRACE" ? "Grace period" : status === "PENDING_PAYMENT" ? "Pending Payment" : status[0] + status.slice(1).toLowerCase()}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-left">{[["Scans", r.scans], ["Reviews", r.sessions]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#FAF7F2] px-3 py-2"><p className="text-[10px] font-semibold uppercase text-[#716B64]">{label}</p><p className="mt-0.5 text-sm font-bold">{value}</p></div>)}</div><p className="mt-3 text-xs font-semibold text-[#2E6B4F]">{status === "PENDING_PAYMENT" ? "QR generated · locked until payment approval" : status === "DISABLED" ? "Disabled" : until ? `${days > 0 ? `${days} days left` : `Expired ${Math.abs(days)} days ago`} · until ${until.toLocaleDateString("en-IN", { dateStyle: "medium" })}` : "Active"}</p></div></div><div className="flex flex-wrap justify-center gap-2 border-t border-[#E8DFD1] bg-[#FAF7F2]/60 p-3 sm:justify-end sm:px-5">{active && images[r.id] && <><a href={images[r.id]} download={`${r.name.replace(/[^a-z0-9]+/gi, "-")}-qr.png`} className="rounded-xl border border-[#E8DFD1] bg-white px-3 py-2 text-xs font-semibold">Download PNG</a><Link to={`/dashboard/qr/${r.id}/print`} className="rounded-xl bg-[#24211E] px-3 py-2 text-xs font-semibold text-white">Print stand card</Link></>}{!active && (status === "PENDING_PAYMENT" ? <Link to="/dashboard/qr-requests" className="rounded-xl bg-[#B58A4B] px-3 py-2 text-xs font-bold text-white">Complete payment</Link> : <a href={renewalEmail} className="rounded-xl bg-[#B58A4B] px-3 py-2 text-xs font-bold text-white">Contact to renew</a>)}</div></article>;
    })}</div>
  </div>;
}
