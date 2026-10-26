import { notFound, redirect } from "next/navigation";
import { getOwnerContext, getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractSocialHandle } from "@/lib/social-format";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintableTableTentPage({
  params,
}: {
  params: { id: string };
}) {
  const [ctx, admin] = await Promise.all([getOwnerContext(), getSuperAdmin()]);
  if (!ctx && !admin) redirect("/login");

  const qr = await db.qrCode.findUnique({
    where: { id: params.id },
    include: { restaurant: true },
  });

  if (!qr) notFound();

  // If owner, ensure it belongs to their restaurant
  if (ctx && qr.restaurantId !== ctx.restaurant.id) {
    notFound();
  }

  const r = qr.restaurant;
  const brandColor = r.brandColor || "#1F6F5C";
  const igHandle = extractSocialHandle(r.instagramUrl, "instagram");
  const fbHandle = extractSocialHandle(r.facebookUrl, "facebook");
  const placement = [qr.location, qr.tableNo ? `Table ${qr.tableNo}` : null]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="min-h-screen bg-zinc-100 py-8 px-4 text-ink print:bg-white print:p-0">
      {/* Top action bar - hidden during print */}
      <div className="mx-auto mb-6 flex max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-sm print:hidden">
        <Link
          href="/dashboard/qr"
          className="inline-flex items-center text-xs text-ink/70 hover:text-ink underline"
        >
          ← Back to QR codes
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      {/* The Printable Table Tent Card */}
      <div className="mx-auto flex justify-center">
        <div
          id="printable-card"
          className="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-lg print:border-zinc-300 print:shadow-none print:max-w-none print:w-[360px] print:m-0 print:rounded-2xl"
        >
          {/* Top Brand Stripe */}
          <div
            className="absolute top-0 left-0 right-0 h-3 rounded-t-3xl print:rounded-t-2xl"
            style={{ backgroundColor: brandColor }}
          />

          {/* Restaurant Header */}
          <div className="pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.logoUrl || "/logo.png"}
              alt={`${r.name} logo`}
              className="mx-auto mb-2 h-14 w-28 rounded-lg border border-zinc-200 bg-[#F7F2E9] p-1 object-contain shadow-sm"
            />
            <h1 className="text-2xl font-bold tracking-tight text-ink">{r.name}</h1>
            {r.city && <p className="text-xs text-ink/60">{r.city}</p>}

            {placement && (
              <span className="mt-2 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {placement}
              </span>
            )}
          </div>

          {/* Call to action */}
          <div className="my-5 border-y border-dashed border-zinc-200 py-3">
            <p className="text-sm font-semibold text-ink">Enjoyed your experience?</p>
            <p className="text-xs text-ink/60 mt-0.5">
              Scan below to rate your visit and share your review.
            </p>
          </div>

          {/* QR Code Container with Frame */}
          <div className="relative mx-auto my-3 flex w-56 flex-col items-center justify-center rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-inner">
            <img
              src={`/api/qr/${qr.id}/download?format=png&inline=1`}
              alt={`QR Code for ${qr.name}`}
              className="h-48 w-48 object-contain"
            />
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-ink/70">
              <svg className="h-3.5 w-3.5 text-ink/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              <span>Scan with phone camera</span>
            </div>
          </div>

          {/* Social Badges Section */}
          <div className="mt-5 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">
              Connect &amp; Share With Us
            </p>

            <div className="flex flex-col gap-2 text-left">
              {/* Instagram Badge */}
              {r.instagramUrl && (
                <div className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-pink-600 shrink-0">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                    </svg>
                    <span className="font-semibold text-pink-900">Instagram</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-pink-700">{igHandle}</span>
                </div>
              )}

              {/* Facebook Badge */}
              {r.facebookUrl && (
                <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-blue-600 shrink-0">
                      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                    </svg>
                    <span className="font-semibold text-blue-900">Facebook</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-blue-700">{fbHandle}</span>
                </div>
              )}

              {/* Google Reviews Badge */}
              {r.googleReviewUrl && (
                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z" />
                      <path fill="#34A853" d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.6C3.7 20.4 7.5 23.2 12 23.2z" />
                    </svg>
                    <span className="font-semibold text-zinc-900">Google Reviews</span>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700">★ ★ ★ ★ ★</span>
                </div>
              )}
            </div>

            {/* Share caption or tagline */}
            {r.shareCaption && (
              <div className="rounded-xl border border-zinc-200 bg-white p-2.5 text-center text-[11px] italic text-zinc-600">
                &ldquo;{r.shareCaption}&rdquo;
              </div>
            )}
          </div>

          {/* Card footer */}
          <div className="mt-5 border-t border-zinc-100 pt-3 text-[10px] text-zinc-400">
            Powered by ReviewFlow
          </div>
        </div>
      </div>
    </div>
  );
}
