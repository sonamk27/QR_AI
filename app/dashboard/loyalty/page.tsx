import { redirect } from "next/navigation";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";
import { LoyaltySettingsView } from "@/components/loyalty/LoyaltySettingsView";

export const dynamic = "force-dynamic";

export default async function LoyaltyDashboardPage() {
  const ctx = await getOwnerContext();
  if (!ctx) redirect("/login");

  const restaurantId = ctx.restaurant.id;
  const program = await getOrCreateLoyaltyProgram(restaurantId);

  // Fetch summary counts
  const [totalCustomers, totalTransactions, unredeemedRewards, redeemedRewards] = await Promise.all([
    db.loyaltyCustomer.count({
      where: { programId: program.id },
    }),
    db.loyaltyTransaction.count({
      where: { programId: program.id },
    }),
    db.loyaltyReward.count({
      where: { programId: program.id, status: "UNREDEEMED" },
    }),
    db.loyaltyReward.count({
      where: { programId: program.id, status: "REDEEMED" },
    }),
  ]);

  // Fetch recent activity
  const recentActivity = await db.loyaltyTransaction.findMany({
    where: { programId: program.id },
    include: {
      customer: {
        select: {
          phone: true,
          name: true,
          currentStamps: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  // Get active QR slug for customer card preview
  const primaryQr = await db.qrCode.findFirst({
    where: { restaurantId, status: "ACTIVE" },
    select: { slug: true },
  });

  return (
    <LoyaltySettingsView
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
      }}
      stats={{
        totalCustomers,
        totalTransactions,
        unredeemedRewards,
        redeemedRewards,
      }}
      recentActivity={recentActivity.map((tx) => ({
        id: tx.id,
        stampsCount: tx.stampsCount,
        billAmount: tx.billAmount,
        billReference: tx.billReference,
        createdAt: tx.createdAt.toISOString(),
        customer: {
          phone: tx.customer.phone,
          name: tx.customer.name,
          currentStamps: tx.customer.currentStamps,
        },
      }))}
      qrSlug={primaryQr?.slug}
    />
  );
}
