import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";
import { useAuthState } from "./AuthState";

type Restaurant = {
  name: string; businessType?: string; city?: string | null; brandColor?: string; status?: string; primaryQrId?: string | null;
  logoUrl?: string | null; googleReviewUrl?: string | null; instagramUrl?: string | null;
  facebookUrl?: string | null; shareCaption?: string | null;
};
export type DashboardOutletContext = { restaurant: Restaurant | null; restaurantId: string | null; refreshRestaurant: () => Promise<void> };

const groups = [
  { label: "Workspace", items: [{ href: "/dashboard", label: "Dashboard", icon: "📊" }] },
  { label: "Guest Experience", items: [
    { href: "/dashboard/loyalty", label: "Loyalty Program", icon: "☕" },
    { href: "/dashboard/feedback", label: "Reviews & Feedback", icon: "💬" },
    { href: "/dashboard/insights", label: "Insights", icon: "💡" },
    { href: "/dashboard/drafts", label: "Review Drafts", icon: "✨" },
  ] },
  { label: "QR Codes", items: [
    { href: "/dashboard/qr-requests", label: "QR Requests", icon: "📝" },
    { href: "/dashboard/qr", label: "QR Code", icon: "📱" },
  ] },
  { label: "Account", items: [
    { href: "/dashboard/payments", label: "Invoices & Billing", icon: "🧾" },
    { href: "/dashboard/profile", label: "Business Settings", icon: "⚙️" },
  ] },
];

export default function DashboardShell() {
  const { user, profile } = useAuthState();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  async function refreshRestaurant() {
    if (!user) return;
    const snap = await getDocs(query(collection(getFirebaseServices().db, "restaurants"), where("ownerUid", "==", user.uid)));
    const first = snap.docs[0];
    setRestaurantId(first?.id ?? null);
    setRestaurant(first ? first.data() as Restaurant : null);
  }

  useEffect(() => {
    if (!user) return;
    void refreshRestaurant().catch((error) => console.error("Could not load restaurant profile", error));
  }, [user]);

  async function logout() {
    await signOut(getFirebaseServices().auth);
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#F7F2E9] text-[#24211E] md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-[#38332E] bg-[#24211E] p-4 text-stone-200 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="hidden border-b border-[#38332E] pb-4 md:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F7F2E9] px-1.5 shadow-sm"><img src="/logo.svg" alt="ReviewFlow logo" className="h-auto w-full object-contain" /></span>
            <div className="min-w-0 flex-1"><h2 className="truncate font-display text-base font-bold leading-tight text-white">{restaurant?.name ?? "ReviewFlow"}</h2><p className="truncate text-[11px] text-stone-400">{restaurant?.city || "Restaurant Portal"}</p></div>
          </div>
        </div>
        <div className="mb-2 flex items-center justify-between border-b border-[#38332E] pb-3 md:hidden">
          <div className="flex items-center gap-2"><img src="/logo.svg" alt="ReviewFlow logo" className="h-10 w-10 rounded-lg bg-[#F7F2E9] object-contain p-1" /><span className="max-w-[160px] truncate font-display text-sm font-bold text-white">{restaurant?.name ?? "ReviewFlow"}</span></div>
          <button onClick={logout} className="rounded-lg bg-stone-800/80 px-2.5 py-1 text-xs font-semibold text-stone-300">Sign out</button>
        </div>
        <nav aria-label="Restaurant navigation" className="flex gap-1 overflow-x-auto md:mt-4 md:min-h-0 md:flex-1 md:flex-col md:gap-3 md:overflow-y-auto md:overflow-x-hidden">
          {groups.map((group) => <div key={group.label} className="flex shrink-0 items-center gap-1 md:block md:space-y-1">
            <p className="hidden px-3.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 md:block">{group.label}</p>
            {group.items.map((item) => {
              const active = item.href === "/dashboard" ? location.pathname === item.href : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} to={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 text-xs font-medium transition ${active ? "bg-[#B58A4B] font-semibold text-white shadow-xs" : "text-stone-300 hover:bg-[#2F2B27] hover:text-white"}`}><span className="text-sm">{item.icon}</span>{item.label}</Link>;
            })}
          </div>)}
        </nav>
        <div className="mt-auto hidden shrink-0 border-t border-[#38332E] pt-4 md:block">
          <div className="flex items-center justify-between"><div className="min-w-0 pr-2"><p className="truncate text-xs font-semibold text-white">{profile?.name}</p><p className="truncate font-mono text-[11px] text-stone-400">{profile?.email}</p></div><button onClick={logout} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-stone-300 hover:bg-stone-800 hover:text-white">Sign out</button></div>
        </div>
      </aside>
      <main className="mx-auto min-w-0 w-full max-w-6xl p-4 sm:p-5 md:p-8">
        {restaurant?.status && restaurant.status !== "ACTIVE" && <div role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">This restaurant profile is pending activation. Please contact support.</div>}
        <Outlet context={{ restaurant, restaurantId, refreshRestaurant } satisfies DashboardOutletContext} />
      </main>
    </div>
  );
}
