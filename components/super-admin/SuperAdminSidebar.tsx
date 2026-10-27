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

  const navGroups: { label: string; items: SuperAdminNavItem[] }[] = [
    { label: "Overview", items: [{ href: "/super-admin", label: "Platform Overview", icon: "⚡" }] },
    {
      label: "QR Codes",
      items: [
        {
          href: "/super-admin/qr-requests",
          label: "QR Requests",
          icon: "📥",
          badge: pendingRequestsCount && pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
        },
        { href: "/super-admin/qr-codes", label: "QR Fleet", icon: "🔲" },
      ],
    },
    {
      label: "Platform",
      items: [
        { href: "/super-admin/restaurants", label: "Restaurants", icon: "🏢" },
        { href: "/super-admin/audit", label: "Audit Log", icon: "📜" },
        { href: "/super-admin/users", label: "User Management", icon: "👥" },
      ],
    },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-auto flex-col justify-between border-b border-[#38332E] bg-[#24211E] p-4 text-stone-200 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* SuperAdmin Brand Header */}
        <div className="pb-4 border-b border-[#38332E]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-20 shrink-0 items-center justify-center rounded-lg bg-[#F7F2E9] px-1.5 shadow-sm">
                <Image src="/logo.png" alt="" width={160} height={80} className="h-auto w-full object-contain" />
              </span>
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
        <nav aria-label="Platform navigation" className="mt-4 flex gap-1 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:gap-3 md:overflow-y-auto md:overflow-x-hidden">
          {navGroups.map((group) => (
            <div key={group.label} className="flex shrink-0 items-center gap-1 md:block md:space-y-1">
              <p className="hidden px-3.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 md:block">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive =
                  item.href === "/super-admin"
                    ? pathname === "/super-admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-11 items-center justify-between whitespace-nowrap rounded-xl px-3.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5B568] ${
                      isActive
                        ? "bg-[#B58A4B] text-white shadow-xs font-semibold"
                        : "text-stone-300 hover:bg-[#2F2B27] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-sm opacity-90">{item.icon}</span>
                      <span>{item.label}</span>
                    </span>

                    {item.badge != null && (
                      <span
                        className={`ml-3 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-xs ${
                          isActive ? "bg-white text-[#24211E]" : "bg-[#B58A4B] text-white"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Super Admin Profile & Sign Out Footer */}
      <div className="mt-6 shrink-0 border-t border-[#38332E] pt-4 md:mt-auto">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-xs font-semibold text-white">{admin.name}</p>
            <p className="truncate text-[11px] text-stone-400 font-mono">{admin.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-stone-300 hover:bg-[#2F2B27] hover:text-white transition"
          >
            <span aria-hidden="true">↗</span>
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
