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
            className={`flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              isActive
                ? "bg-[#B58A4B] text-white shadow-xs font-semibold"
                : "text-stone-300 hover:bg-stone-800 hover:text-white"
            }`}
          >
            <span>{label}</span>
            {badge != null && Number(badge) > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#B58A4B] px-1.5 text-[11px] font-bold text-white shadow-2xs">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
