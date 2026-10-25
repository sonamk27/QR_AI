"use client";

import Link from "next/link";
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

  const navItems: AdminNavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "📊" },
    {
      href: "/dashboard/qr-requests",
      label: "QR Requests",
      icon: "📝",
      badge: pendingRequestsCount && pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    { href: "/dashboard/qr", label: "QR Codes", icon: "📱" },
    {
      href: "/dashboard/loyalty",
      label: "Stamp & Loyalty",
      icon: "☕",
      badge: pendingStampRequestsCount && pendingStampRequestsCount > 0 ? pendingStampRequestsCount : undefined,
    },
    { href: "/dashboard/feedback", label: "Guest Feedback", icon: "💬" },
    { href: "/dashboard/drafts", label: "Past Drafts", icon: "✨" },
    { href: "/dashboard/insights", label: "AI Insights", icon: "💡" },
    { href: "/dashboard/payments", label: "Payments & Invoices", icon: "🧾" },
    { href: "/dashboard/profile", label: "Restaurant Profile", icon: "⚙️" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col border-b border-line bg-white p-4 md:border-b-0 md:border-r md:min-h-screen">
      {/* Brand Header — hidden on mobile horizontal scroll bar */}
      <div className="hidden md:block pb-3 border-b border-line">
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-bold tracking-tight text-leaf">
            ReviewFlow
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 uppercase tracking-wider">
            Restaurant
          </span>
        </div>

        {/* Restaurant Card */}
        <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-paper/60 p-2 border border-line/60">
          <div
            className="h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-white"
            style={{ backgroundColor: restaurant.brandColor || "#1F6F5C" }}
            title="Brand Accent"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink">{restaurant.name}</p>
            <p className="truncate text-[11px] text-ink/60">{restaurant.city || "Restaurant Portal"}</p>
          </div>
        </div>
      </div>

      {/* Mobile top bar — brand + sign out always visible */}
      <div className="flex items-center justify-between md:hidden pb-2 border-b border-line mb-2">
        <span className="font-display text-base font-bold tracking-tight text-leaf">ReviewFlow</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
        >
          🚪 Sign out
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex gap-1 overflow-x-auto md:mt-4 md:flex-col">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-leaf/10 font-semibold text-leaf"
                  : "text-ink/75 hover:bg-paper hover:text-ink"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </div>

              {item.badge != null && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white shadow-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Owner Profile & Sign Out Footer — desktop only */}
      <div className="hidden md:block mt-auto pt-4 border-t border-line">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-xs font-medium text-ink">{user.name}</p>
            <p className="truncate text-[11px] text-ink/50 font-mono">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
          >
            🚪 Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
