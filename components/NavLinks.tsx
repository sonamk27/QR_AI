"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = [href: string, label: string, badge?: number | string];

export function NavLinks({ links }: { links: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto md:flex-col">
      {links.map(([href, label, badge]) => {
        const isActive =
          href === "/super-admin" || href === "/dashboard"
            ? pathname === href
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
              isActive
                ? "bg-leaf/10 font-semibold text-leaf"
                : "text-ink/80 hover:bg-paper hover:text-ink"
            }`}
          >
            <span>{label}</span>
            {badge != null && Number(badge) > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white shadow-sm">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
