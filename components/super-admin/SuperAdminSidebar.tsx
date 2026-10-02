"use client";

import Link from "next/link";
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
    <aside className="flex flex-col justify-between border-b border-zinc-200 bg-white p-4 md:border-b-0 md:border-r min-h-screen">
      <div>
        {/* SuperAdmin Brand Header */}
        <div className="pb-3 border-b border-zinc-200">
          <div className="flex items-center justify-between">
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              ReviewFlow
            </span>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-200 uppercase tracking-wider">
              Super Admin
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600 border border-zinc-200/80">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Platform Console
            </span>
            <span className="font-mono text-[10px] text-zinc-400">v2.0</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-4 flex gap-1 overflow-x-auto md:flex-col">
          {navItems.map((item) => {
            const isActive =
              item.href === "/super-admin"
                ? pathname === "/super-admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-zinc-900 font-semibold text-white shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </div>

                {item.badge != null && (
                  <span
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold shadow-sm ${
                      isActive ? "bg-amber-400 text-zinc-950" : "bg-amber-500 text-white"
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
      <div className="mt-6 pt-4 border-t border-zinc-200">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-xs font-semibold text-zinc-900">{admin.name}</p>
            <p className="truncate text-[11px] text-zinc-500 font-mono">{admin.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-1.5 text-xs text-zinc-500 hover:bg-rose-50 hover:text-rose-600 transition"
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
