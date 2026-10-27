import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";
import { RestaurantHomeView } from "@/components/restaurant/RestaurantHomeView";

export const dynamic = "force-dynamic";

export default async function RestaurantPublicHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const qr = await db.qrCode.findUnique({
    where: { slug: slug },
    include: { restaurant: true },
  });

  if (!qr || !isActive(qr) || qr.restaurant.status !== "ACTIVE") {
    notFound();
  }

  const program = await getOrCreateLoyaltyProgram(qr.restaurant.id);

  return (
    <RestaurantHomeView
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
      program={{
        id: program.id,
        title: program.title,
        isActive: program.isActive,
        discountType: program.discountType || "FLAT",
        stampsRequired: program.stampsRequired,
        minBillAmount: program.minBillAmount,
        rewardTitle: program.rewardTitle,
        rewardDiscount: program.rewardDiscount,
        rewardExpiryDays: program.rewardExpiryDays,
      }}
    />
  );
}
