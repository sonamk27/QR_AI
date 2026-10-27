import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";
import { CustomerJourneyView } from "@/components/customer/CustomerJourneyView";

export const dynamic = "force-dynamic";

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { slug } = await params;
  const qr = await db.qrCode.findUnique({
    where: { slug: slug },
    include: { restaurant: true },
  });

  if (!qr || !isActive(qr) || qr.restaurant.status !== "ACTIVE") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FDFBF7] p-6 text-center">
        <div className="max-w-sm">
          <p className="mb-4 text-4xl">🔒</p>
          <h1 className="text-2xl font-serif font-bold text-stone-900">QR Code Unavailable</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-stone-600">
            This QR code is currently inactive. Please ask the restaurant staff for assistance.
          </p>
        </div>
      </main>
    );
  }

  const program = await getOrCreateLoyaltyProgram(qr.restaurant.id);

  const initialView =
    resolvedSearchParams?.view === "review" || resolvedSearchParams?.view === "feedback"
      ? "review"
      : resolvedSearchParams?.view === "card" || resolvedSearchParams?.view === "loyalty"
      ? "card"
      : "welcome";

  return (
    <CustomerJourneyView
      slug={slug}
      restaurant={{
        id: qr.restaurant.id,
        name: qr.restaurant.name,
        city: qr.restaurant.city,
        logoUrl: qr.restaurant.logoUrl,
        brandColor: qr.restaurant.brandColor,
        googleReviewUrl: qr.restaurant.googleReviewUrl,
        instagramUrl: qr.restaurant.instagramUrl,
        facebookUrl: qr.restaurant.facebookUrl,
        shareCaption: qr.restaurant.shareCaption,
      }}
      initialProgram={{
        id: program.id,
        title: program.title,
        isActive: program.isActive,
        discountType: program.discountType || "FLAT",
        stampsRequired: program.stampsRequired,
        minBillAmount: program.minBillAmount,
        rewardTitle: program.rewardTitle,
        rewardDiscount: program.rewardDiscount,
        rewardExpiryDays: program.rewardExpiryDays,
        requireOwnerVerification: Boolean(program.terminalPin && program.terminalPin.trim() !== ""),
      }}
      initialView={initialView}
    />
  );
}
