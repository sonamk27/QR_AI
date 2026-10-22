import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";
import { AnonLoyaltyCardView } from "@/components/loyalty/AnonLoyaltyCardView";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage({ params }: { params: { slug: string } }) {
  const qr = await db.qrCode.findUnique({
    where: { slug: params.slug },
    include: { restaurant: true },
  });

  if (!qr || !isActive(qr) || qr.restaurant.status !== "ACTIVE") {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-center">
        <div className="max-w-sm">
          <p className="mb-4 text-4xl">🔒</p>
          <h1 className="text-2xl font-bold text-stone-900">Program Unavailable</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-stone-600">
            This rewards program is currently inactive or unavailable. Please ask the restaurant staff for help.
          </p>
        </div>
      </main>
    );
  }

  return <AnonLoyaltyCardView slug={params.slug} />;
}
