import { notFound, redirect } from "next/navigation";
import { getOwnerContext, getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PrintableTableTentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ctx, admin] = await Promise.all([getOwnerContext(), getSuperAdmin()]);
  if (!ctx && !admin) redirect("/login");

  const qr = await db.qrCode.findUnique({
    where: { id: id },
    include: { restaurant: true },
  });

  if (!qr) notFound();

  // If owner, ensure it belongs to their restaurant
  if (ctx && qr.restaurantId !== ctx.restaurant.id) {
    notFound();
  }

  const r = qr.restaurant;
  const brandColor = r.brandColor || "#1F6F5C";
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
        <button
          onClick={() => window.print()}
          className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-paper"
        >
          Print / Save PDF
        </button>
      </div>

      {/* The Printable Table Tent Card */}
      <div className="mx-auto flex justify-center">
        <div
          id="printable-card"
          className="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xl print:border-zinc-400 print:shadow-none print:max-w-none print:w-[360px] print:m-0 print:rounded-2xl"
        >
          {/* Top Brand Stripe */}
          <div
            className="absolute top-0 left-0 right-0 h-3 rounded-t-3xl print:rounded-t-2xl"
            style={{ backgroundColor: brandColor }}
          />

          {/* Restaurant Name */}
          <div className="pt-4">
            {r.logoUrl ? (
              <img
                src={r.logoUrl}
                alt={`${r.name} logo`}
                className="mx-auto mb-3 h-12 w-24 rounded-lg border border-zinc-200 bg-[#F7F2E9] p-1 object-contain shadow-sm"
              />
            ) : (
              <div className="mx-auto mb-3 h-12 w-24 rounded-lg bg-[#F7F2E9] flex items-center justify-center">
                <span className="text-xl font-bold text-ink">{r.name.charAt(0)}</span>
              </div>
            )}
            <h1 className="text-3xl font-serif font-bold text-ink tracking-tight">{r.name}</h1>
            {placement && (
              <p className="mt-1 text-xs text-ink/60 font-medium">{placement}</p>
            )}
          </div>

          {/* Call to action */}
          <div className="my-6">
            <p className="text-sm font-medium text-ink">How was your visit?</p>
            <p className="text-xs text-ink/50 mt-1">
              Scan to rate and leave your review.
            </p>
          </div>

          {/* QR Code - large and centered */}
          <div className="relative mx-auto my-4 flex w-64 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <img
              src={`/api/qr/${qr.id}/download?format=png&inline=1`}
              alt={`QR Code for ${qr.name}`}
              className="h-48 w-48 object-contain"
            />
            <span className="mt-2 text-[11px] font-medium text-ink/70">
              Scan with phone camera
            </span>
          </div>

          {/* Card footer */}
          <div className="mt-8 border-t border-zinc-100 pt-4 text-[10px] text-zinc-400">
            Powered by ReviewFlow
          </div>
        </div>
      </div>
    </div>
  );
}
