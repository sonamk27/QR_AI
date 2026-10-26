"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export function AdminSidebar({
  restaurant,
  user,
  pendingRequestsCount,
  pendingStampRequestsCount,
}: {
  restaurant: {
    id: string;
    name: string;
    city: string | null;
    brandColor: string;
  };
  user: {
    name: string;
    email: string;
  };
  pendingRequestsCount?: number;
  pendingStampRequestsCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navGroups: { label: string; items: AdminNavItem[] }[] = [
    { label: "Workspace", items: [{ href: "/dashboard", label: "Dashboard", icon: "📊" }] },
    {
      label: "Guest Experience",
      items: [
        {
          href: "/dashboard/loyalty",
          label: "Loyalty Program",
          icon: "☕",
          badge: pendingStampRequestsCount && pendingStampRequestsCount > 0 ? pendingStampRequestsCount : undefined,
        },
        { href: "/dashboard/feedback", label: "Reviews & Feedback", icon: "💬" },
        { href: "/dashboard/insights", label: "AI Insights", icon: "💡" },
        { href: "/dashboard/drafts", label: "Review Drafts", icon: "✨" },
      ],
    },
    {
      label: "QR Codes",
      items: [
        {
          href: "/dashboard/qr-requests",
          label: "QR Requests",
          icon: "📝",
          badge: pendingRequestsCount && pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
        },
        { href: "/dashboard/qr", label: "QR Code", icon: "📱" },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/dashboard/payments", label: "Invoices & Billing", icon: "🧾" },
        { href: "/dashboard/profile", label: "Restaurant Settings", icon: "⚙️" },
      ],
    },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col border-b border-[#38332E] bg-[#24211E] p-4 text-stone-200 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
      {/* Brand Header */}
      <div className="hidden md:block pb-4 border-b border-[#38332E]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-12 w-24 shrink-0 items-center justify-center rounded-xl bg-[#F7F2E9] px-1.5 shadow-sm">
            <Image src="/logo.png" alt="ReviewLoop" width={160} height={80} className="h-auto w-full object-contain" priority />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold text-white truncate leading-tight">
              {restaurant.name}
            </h2>
            <p className="text-[11px] text-stone-400 truncate">
              {restaurant.city || "Restaurant Portal"}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between md:hidden pb-3 border-b border-[#38332E] mb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-20 shrink-0 items-center justify-center rounded-lg bg-[#F7F2E9] px-1 shadow-sm">
            <Image src="/logo.png" alt="ReviewLoop" width={160} height={80} className="h-auto w-full object-contain" priority />
          </span>
          <span className="font-display text-sm font-bold text-white truncate max-w-[160px]">
            {restaurant.name}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-300 bg-stone-800/80 hover:bg-stone-800 hover:text-white transition"
        >
          <span>🚪</span> Sign out
        </button>
      </div>

      {/* Navigation Items */}
      <nav aria-label="Restaurant navigation" className="flex gap-1 overflow-x-auto md:mt-4 md:min-h-0 md:flex-1 md:flex-col md:gap-3 md:overflow-y-auto md:overflow-x-hidden">
        {navGroups.map((group) => (
          <div key={group.label} className="flex shrink-0 items-center gap-1 md:block md:space-y-1">
            <p className="hidden px-3.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 md:block">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
                    <span className="ml-3 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E5B568] px-1.5 text-[10px] font-bold text-[#24211E] shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Owner Profile & Sign Out Footer — desktop only */}
      <div className="mt-auto hidden shrink-0 border-t border-[#38332E] pt-4 md:block">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-stone-400 font-mono">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-stone-300 hover:bg-stone-800 hover:text-white transition"
          >
            <span aria-hidden="true">↗</span>
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
