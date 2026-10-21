import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";
import { StaffTerminalView } from "@/components/loyalty/StaffTerminalView";

export const dynamic = "force-dynamic";

export default async function TerminalPublicPage({ params }: { params: { slug: string } }) {
  const qr = await db.qrCode.findUnique({
    where: { slug: params.slug },
    include: { restaurant: true },
  });

  if (!qr || !isActive(qr) || qr.restaurant.status !== "ACTIVE") {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-center">
        <div className="max-w-sm">
          <p className="mb-4 text-4xl">🔒</p>
          <h1 className="text-2xl font-bold text-stone-900">Terminal Inactive</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-stone-600">
            This QR code or restaurant profile is currently inactive.
          </p>
        </div>
      </main>
    );
  }

  const program = await getOrCreateLoyaltyProgram(qr.restaurant.id);

  return (
    <div className="min-h-screen bg-stone-100/60 p-4 pt-8 md:p-12">
      <StaffTerminalView
        restaurant={{
          id: qr.restaurant.id,
          name: qr.restaurant.name,
          brandColor: qr.restaurant.brandColor,
        }}
        slug={params.slug}
        initialProgram={{
          id: program.id,
          title: program.title,
          isActive: program.isActive,
          stampsRequired: program.stampsRequired,
          minBillAmount: program.minBillAmount,
          rewardTitle: program.rewardTitle,
          rewardDiscount: program.rewardDiscount,
          rewardExpiryDays: program.rewardExpiryDays,
        }}
      />
    </div>
  );
}
