import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";
import { useAuthState } from "./AuthState";

type Summary = {
  qrCount: number; scans: number; sessions: number; googleClicks: number;
  instagramClicks: number; facebookClicks: number; avgOverall: number | null;
  avgFood: number | null; avgService: number | null; distribution: { rating: number; count: number }[];
};

const emptySummary: Summary = {
  qrCount: 0, scans: 0, sessions: 0, googleClicks: 0, instagramClicks: 0,
  facebookClicks: 0, avgOverall: null, avgFood: null, avgService: null,
  distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
};

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "string" || typeof value === "number") return new Date(value).getTime();
  return 0;
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#716B64]">{label}</p><p className="mt-3 font-serif text-3xl font-bold leading-none text-[#24211E]">{value}</p><p className="mt-2 text-xs leading-relaxed text-[#716B64]">{detail}</p></article>;
}

export default function OwnerDashboardPage() {
  const { user, profile } = useAuthState();
  const [summary, setSummary] = useState(emptySummary);
  const [restaurantName, setRestaurantName] = useState("your restaurant");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const { db } = getFirebaseServices();
      const restaurantSnap = await getDocs(query(collection(db, "restaurants"), where("ownerUid", "==", user.uid)));
      const restaurant = restaurantSnap.docs[0]?.data();
      if (restaurant?.name) setRestaurantName(restaurant.name);
      const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const sinceDate = new Date(since);
      const [qrSnap, scanSnap, feedbackSnap, clickSnap] = await Promise.all([
        getDocs(query(collection(db, "qrCodes"), where("ownerUid", "==", user.uid))),
        getDocs(query(collection(db, "scans"), where("ownerUid", "==", user.uid), where("createdAt", ">=", sinceDate))),
        getDocs(query(collection(db, "feedbackSessions"), where("ownerUid", "==", user.uid), where("completedAt", ">=", sinceDate))),
        getDocs(query(collection(db, "socialClicks"), where("ownerUid", "==", user.uid), where("createdAt", ">=", sinceDate))),
      ]);
      const sessions = feedbackSnap.docs.map((doc) => doc.data()).filter((row) => {
        const date = timestampMillis(row.completedAt ?? row.createdAt);
        return date >= since && row.overallRating != null;
      });
      const scans = scanSnap.docs.filter((doc) => timestampMillis(doc.data().createdAt) >= since).length;
      const clicks = clickSnap.docs.map((doc) => doc.data()).filter((row) => timestampMillis(row.createdAt) >= since);
      const avg = (field: string) => {
        const values = sessions.map((row) => Number(row[field])).filter(Number.isFinite);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      };
      setSummary({
        qrCount: qrSnap.size, scans, sessions: sessions.length,
        googleClicks: sessions.filter((row) => timestampMillis(row.googleClickedAt) >= since).length,
        instagramClicks: clicks.filter((row) => row.platform === "instagram").length,
        facebookClicks: clicks.filter((row) => row.platform === "facebook").length,
        avgOverall: avg("overallRating"), avgFood: avg("foodRating"), avgService: avg("serviceRating"),
        distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: sessions.filter((row) => Number(row.overallRating) === rating).length })),
      });
    } catch (caught) {
      console.error("Dashboard data could not be loaded", caught);
      setError("Could not load dashboard data. Check your Firestore setup and access rules.");
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const max = Math.max(1, ...summary.distribution.map((item) => item.count));

  return <div className="space-y-6 sm:space-y-7">
    <header className="flex flex-col gap-4 border-b border-[#E8DFD1] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A7441]">Restaurant overview · Last 30 days</p><h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#24211E] sm:text-3xl">{greeting}, {profile?.name.split(" ")[0]}</h1><p className="mt-1 text-sm text-[#716B64]">Here’s how {restaurantName} is doing.</p></div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center"><button onClick={() => void load()} disabled={busy} className="min-h-11 rounded-xl border border-[#E8DFD1] bg-white px-3.5 text-xs font-semibold text-[#24211E]">{busy ? "Loading…" : "Refresh"}</button><Link to="/dashboard/feedback" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E8DFD1] bg-white px-3.5 text-xs font-semibold text-[#24211E]">View feedback</Link><Link to="/dashboard/qr" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B58A4B] px-3.5 text-xs font-bold text-white">View QR code</Link></div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section aria-label="Last 30 days metrics" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
      <MetricCard label="Average rating" value={summary.avgOverall != null ? summary.avgOverall.toFixed(1) : "—"} detail={`${summary.sessions} guest responses`} />
      <MetricCard label="QR scans" value={summary.scans} detail="Guest visits from your QR codes" />
      <MetricCard label="Feedback" value={summary.sessions} detail="Completed guest responses" />
      <MetricCard label="Google visits" value={summary.googleClicks} detail="Guests who continued to Google" />
      <MetricCard label="Social visits" value={summary.instagramClicks + summary.facebookClicks} detail={`${summary.instagramClicks} Instagram · ${summary.facebookClicks} Facebook`} />
    </section>
    {summary.sessions === 0 ? <section className="flex flex-col gap-4 rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-subtle sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9A7441]">Getting started</p><h2 className="mt-1 font-serif text-xl font-bold text-[#24211E]">{summary.qrCount === 0 ? "Get your first QR code" : summary.scans === 0 ? "Put your QR code to work" : "Your guest feedback will appear here"}</h2><p className="mt-1.5 text-sm leading-relaxed text-[#716B64]">{summary.qrCount === 0 ? "Request a QR code for your restaurant. Once it’s approved and active, you can download and place it for guests." : summary.scans === 0 ? "Download or print your QR code and place it where guests can easily scan it." : `${summary.scans} guests have scanned your QR code. Completed feedback and ratings will appear here.`}</p></div><Link to={summary.qrCount === 0 ? "/dashboard/qr-requests" : "/dashboard/qr"} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#B58A4B] px-4 text-xs font-bold text-white">{summary.qrCount === 0 ? "Request a QR code" : "Open QR management"}</Link></section> : <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6"><h2 className="font-serif text-base font-bold text-[#24211E]">Rating spread</h2><p className="mt-0.5 text-xs text-[#716B64]">Guest responses by star rating</p><div className="mt-4 space-y-2.5">{[...summary.distribution].reverse().map((item) => <div key={item.rating} className="flex items-center gap-3 text-xs"><span className="w-6 font-semibold">{item.rating}★</span><div className="h-2.5 flex-1 overflow-hidden rounded-full border border-[#E8DFD1]/50 bg-[#FAF7F2]"><div className="h-full rounded-full bg-[#B58A4B]" style={{ width: `${(item.count / max) * 100}%` }} /></div><span className="w-8 text-right font-mono text-[#716B64]">{item.count}</span></div>)}</div></section>
      <section className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6"><h2 className="font-serif text-base font-bold text-[#24211E]">What guests rate</h2><dl className="mt-4 space-y-3 text-xs"><div className="flex items-center justify-between border-b border-[#E8DFD1]/50 pb-2"><dt className="text-[#716B64]">Food Rating</dt><dd className="font-serif text-base font-bold">{summary.avgFood?.toFixed(1) ?? "—"}</dd></div><div className="flex items-center justify-between border-b border-[#E8DFD1]/50 pb-2"><dt className="text-[#716B64]">Service Rating</dt><dd className="font-serif text-base font-bold">{summary.avgService?.toFixed(1) ?? "—"}</dd></div></dl><p className="mt-4 border-t border-[#E8DFD1]/60 pt-3 text-xs leading-relaxed text-[#716B64]">{summary.avgOverall != null && summary.avgOverall >= 4 ? "Guests are enjoying their visits. Keep up the good work." : "As more feedback arrives, you’ll see patterns and improvement opportunities here."}</p></section>
    </div>}
  </div>;
}
