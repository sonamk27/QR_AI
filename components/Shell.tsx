import Link from "next/link";
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
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-line bg-white p-4 md:border-b-0 md:border-r">
        <p className="font-display text-lg font-semibold">ReviewFlow</p>
        <p className="mt-0.5 truncate text-xs text-ink/60">{title}</p>
        <NavLinks links={links} />
        <div className="mt-4 hidden md:block">
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
  <div className="panel p-4">
    <p className="text-sm text-ink/60">{label}</p>
    <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
  </div>
);

export const Empty = ({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) => (
  <div className="panel p-8 text-center">
    <p className="font-display text-lg font-semibold">{title}</p>
    <p className="mx-auto mt-1 max-w-sm text-sm text-ink/70">{body}</p>
    {href && cta && <Link href={href} className="btn mt-4">{cta}</Link>}
  </div>
);
