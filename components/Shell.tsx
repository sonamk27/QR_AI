import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "./LogoutButton";
import { NavLinks, type NavItem } from "./NavLinks";

export function Shell({
  title,
  links,
  children,
}: {
  title: string;
  links: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ivory md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-warmBorder bg-charcoal text-white p-5 md:border-b-0 md:border-r md:min-h-screen flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ReviewFlow" width={64} height={32} className="shrink-0 rounded-lg object-contain" />
            <p className="font-display text-xl font-bold tracking-tight text-white">ReviewFlow</p>
          </div>
          <p className="mt-1 truncate text-xs text-warmGray-light">{title}</p>
          <div className="mt-6">
            <NavLinks links={links} />
          </div>
        </div>
        <div className="mt-8 hidden md:block pt-4 border-t border-charcoal-700">
          <LogoutButton />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl p-5 md:p-8">
        {children}
        <div className="mt-10 md:hidden">
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}

export const Stat = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
  <div className="panel p-5 transition hover:shadow-md">
    <p className="text-xs font-semibold uppercase tracking-wider text-warmGray">{label}</p>
    <p className="mt-2 font-display text-3xl font-bold text-charcoal">{value}</p>
    {hint && <p className="mt-1 text-xs text-warmGray">{hint}</p>}
  </div>
);

export const Empty = ({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) => (
  <div className="panel p-8 text-center sm:p-12">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-100 text-2xl text-gold">
      ✨
    </div>
    <p className="font-display text-xl font-bold text-charcoal">{title}</p>
    <p className="mx-auto mt-2 max-w-sm text-sm text-warmGray leading-relaxed">{body}</p>
    {href && cta && (
      <Link href={href} className="btn mt-5 inline-flex">
        {cta}
      </Link>
    )}
  </div>
);
