import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { getFirebaseServices } from "./firebase";
import { useAuthState } from "./AuthState";

const links = [
  { href: "/super-admin/qr-requests", label: "QR Requests", icon: "📥" },
  { href: "/super-admin/qr-codes", label: "QR Fleet", icon: "🔲" },
  { href: "/super-admin/restaurants", label: "Restaurants", icon: "🏢" },
  { href: "/super-admin/audit", label: "Audit Log", icon: "📜" },
  { href: "/super-admin/users", label: "User Management", icon: "👥" },
];

export default function SuperAdminShell() {
  const { profile } = useAuthState(); const location = useLocation(); const navigate = useNavigate();
  async function logout() { await signOut(getFirebaseServices().auth); navigate("/login", { replace: true }); }
  return <div className="min-h-screen bg-[#F7F2E9] text-[#24211E] md:grid md:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="flex flex-col border-b border-[#38332E] bg-[#24211E] p-4 text-stone-200 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
      <div className="border-b border-[#38332E] pb-4"><div className="flex items-center gap-3"><span className="flex h-10 w-20 items-center justify-center rounded-lg bg-[#F7F2E9] px-1.5">      <img src="/logo.svg" alt="ReviewFlow logo" className="h-auto w-full object-contain" /></span><span className="font-serif text-lg font-bold text-white">ReviewFlow</span></div><div className="mt-3 rounded-xl border border-[#3E3831] bg-[#2E2A25] px-3 py-2 text-[11px] text-stone-300"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />Platform Console</div></div>
      <nav aria-label="Platform navigation" className="mt-4 flex gap-1 overflow-x-auto md:flex-1 md:flex-col md:gap-1 md:overflow-visible">{links.map((item) => { const active = location.pathname === item.href; return <Link key={item.href} to={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 text-xs font-medium transition ${active ? "bg-[#B58A4B] font-semibold text-white" : "text-stone-300 hover:bg-[#2F2B27] hover:text-white"}`}><span>{item.icon}</span>{item.label}</Link>; })}</nav>
      <div className="mt-4 hidden shrink-0 border-t border-[#38332E] pt-4 md:block"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{profile?.name}</p><p className="truncate font-mono text-[11px] text-stone-400">{profile?.email}</p></div><button onClick={logout} className="min-h-10 rounded-lg px-3 text-xs text-stone-300 hover:bg-stone-800">Sign out</button></div></div>
      <button onClick={logout} className="mt-2 min-h-10 rounded-lg px-3 text-left text-xs text-stone-300 hover:bg-stone-800 md:hidden">Sign out</button>
    </aside>
    <main className="mx-auto min-w-0 w-full max-w-7xl p-4 sm:p-5 md:p-8"><Outlet /></main>
  </div>;
}
