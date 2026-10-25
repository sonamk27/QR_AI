"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

export type SuperAdminNavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export function SuperAdminSidebar({
  admin,
  pendingRequestsCount,
}: {
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  pendingRequestsCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems: SuperAdminNavItem[] = [
    { href: "/super-admin", label: "Platform Overview", icon: "⚡" },
    {
      href: "/super-admin/qr-requests",
      label: "QR Requests",
      icon: "📥",
      badge: pendingRequestsCount && pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    { href: "/super-admin/restaurants", label: "Restaurants", icon: "🏢" },
    { href: "/super-admin/qr-codes", label: "QR Fleet", icon: "🔲" },
    { href: "/super-admin/payments", label: "Payments Ledger", icon: "💳" },
    { href: "/super-admin/audit", label: "Audit Log", icon: "📜" },
    { href: "/super-admin/users", label: "User Management", icon: "👥" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col justify-between border-b border-[#38332E] bg-[#24211E] text-stone-200 p-4 md:border-b-0 md:border-r min-h-screen">
      <div>
        {/* SuperAdmin Brand Header */}
        <div className="pb-4 border-b border-[#38332E]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="ReviewFlow" width={48} height={24} className="rounded-lg object-contain shrink-0" />
              <span className="font-serif text-xl font-bold tracking-tight text-white">
                ReviewFlow
              </span>
            </div>
            <span className="rounded-full bg-[#B58A4B]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#DDB576] border border-[#B58A4B]/30 uppercase tracking-wider">
              Super Admin
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-xl bg-[#2E2A25] px-2.5 py-1.5 text-[11px] text-stone-300 border border-[#3E3831]">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Platform Console
            </span>
            <span className="font-mono text-[10px] text-stone-400">v2.0</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-4 flex gap-1 overflow-x-auto md:flex-col md:space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/super-admin"
                ? pathname === "/super-admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-[#B58A4B] text-white shadow-xs font-semibold"
                    : "text-stone-300 hover:bg-[#2F2B27] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm opacity-90">{item.icon}</span>
                  <span>{item.label}</span>
                </div>

                {item.badge != null && (
                  <span
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-xs ${
                      isActive ? "bg-white text-[#24211E]" : "bg-[#B58A4B] text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Super Admin Profile & Sign Out Footer */}
      <div className="mt-6 pt-4 border-t border-[#38332E]">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-xs font-semibold text-white">{admin.name}</p>
            <p className="truncate text-[11px] text-stone-400 font-mono">{admin.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-2 text-xs text-stone-400 hover:bg-[#2F2B27] hover:text-rose-400 transition"
          >
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}
