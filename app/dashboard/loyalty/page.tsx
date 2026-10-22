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

  // Fetch summary counts across both anonymous and registered phone flows
  const [
    phoneCustomers,
    anonCustomers,
    phoneTransactions,
    anonTransactions,
    phoneUnredeemedRewards,
    anonUnredeemedRewards,
    phoneRedeemedRewards,
    anonRedeemedRewards,
    reviewClicksCount,
  ] = await Promise.all([
    db.loyaltyCustomer.count({ where: { programId: program.id } }),
    db.anonymousCustomer.count({ where: { restaurantId } }),
    db.loyaltyTransaction.count({ where: { programId: program.id } }),
    db.anonymousStampTransaction.count({ where: { customer: { restaurantId } } }),
    db.loyaltyReward.count({ where: { programId: program.id, status: "UNREDEEMED" } }),
    db.anonymousReward.count({ where: { programId: program.id, status: "UNREDEEMED" } }),
    db.loyaltyReward.count({ where: { programId: program.id, status: "REDEEMED" } }),
    db.anonymousReward.count({ where: { programId: program.id, status: "REDEEMED" } }),
    db.feedbackSession.count({
      where: {
        qr: { restaurantId },
        googleClickedAt: { not: null },
      },
    }),
  ]);

  // Fetch recent customers for the "Recent Customers" table in the dashboard mockup
  const customersList = await db.loyaltyCustomer.findMany({
    where: { programId: program.id },
    orderBy: { lastVisitAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      phone: true,
      lifetimeStamps: true,
      currentStamps: true,
      lastVisitAt: true,
      createdAt: true,
    },
  });

  // Fetch recent activity from both tables
  const [recentPhoneActivity, recentAnonActivity] = await Promise.all([
    db.loyaltyTransaction.findMany({
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
      take: 10,
    }),
    db.anonymousStampTransaction.findMany({
      where: { customer: { restaurantId } },
      include: {
        customer: {
          select: {
            id: true,
            currentStamps: true,
          },
        },
        visit: {
          select: {
            verificationRef: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const recentActivity = [
    ...recentPhoneActivity.map((tx) => ({
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
    })),
    ...recentAnonActivity.map((tx) => ({
      id: tx.id,
      stampsCount: tx.amount,
      billAmount: null,
      billReference: tx.visit?.verificationRef || null,
      createdAt: tx.createdAt.toISOString(),
      customer: {
        phone: tx.customer.id,
        name: `Anonymous (${tx.customer.id.slice(0, 8)}…)`,
        currentStamps: tx.customer.currentStamps,
      },
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  // Primary active QR code slug
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
        discountType: program.discountType || "PERCENT",
        stampsRequired: program.stampsRequired,
        minBillAmount: program.minBillAmount,
        rewardTitle: program.rewardTitle,
        rewardDiscount: program.rewardDiscount,
        rewardExpiryDays: program.rewardExpiryDays,
        terminalPin: program.terminalPin || "1234",
      }}
      stats={{
        totalCustomers: phoneCustomers + anonCustomers,
        totalTransactions: phoneTransactions + anonTransactions,
        unredeemedRewards: phoneUnredeemedRewards + anonUnredeemedRewards,
        redeemedRewards: phoneRedeemedRewards + anonRedeemedRewards,
        reviewClicks: reviewClicksCount,
      }}
      recentCustomers={customersList.map((c) => ({
        id: c.id,
        name: c.name || "Aarav Sharma",
        phone: c.phone,
        visits: Math.max(1, c.lifetimeStamps || c.currentStamps),
        stamps: c.currentStamps,
        lastVisit: c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : "Today",
      }))}
      recentActivity={recentActivity}
      qrSlug={primaryQr?.slug}
    />
  );
}
