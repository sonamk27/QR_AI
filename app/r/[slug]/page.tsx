import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";
import { Flow } from "@/components/Flow";

export const dynamic = "force-dynamic";

export default async function Customer({ params }: { params: { slug: string } }) {
  const qr = await db.qrCode.findUnique({
    where: { slug: params.slug },
    include: { restaurant: true },
  });

  if (!qr || !isActive(qr) || qr.restaurant.status !== "ACTIVE") {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <div className="max-w-sm">
          <p className="mb-4 text-4xl">🔒</p>
          <h1 className="text-2xl font-semibold text-ink">This QR isn&apos;t active</h1>
          <p className="mx-auto mt-2 max-w-xs text-ink/70">
            This QR code is unavailable right now. Please ask the restaurant for help.
          </p>
        </div>
      </main>
    );
  }

  return (
    <Flow
      slug={params.slug}
      name={qr.restaurant.name}
      logoUrl={qr.restaurant.logoUrl}
      color={qr.restaurant.brandColor}
    />
  );
}
