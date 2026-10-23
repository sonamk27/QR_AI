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
      rewards: {
        where: { status: "UNREDEEMED" },
        select: { id: true, code: true, rewardTitle: true, expiresAt: true },
      },
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

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);

  const [
    recentPhoneDaily,
    recentAnonDaily,
    recentPhoneMonthly,
    recentAnonMonthly,
  ] = await Promise.all([
    db.loyaltyCustomer.findMany({
      where: { programId: program.id, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    db.anonymousCustomer.findMany({
      where: { restaurantId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    db.loyaltyCustomer.findMany({
      where: { programId: program.id, createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    }),
    db.anonymousCustomer.findMany({
      where: { restaurantId, createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    }),
  ]);

  const initialDailyGrowth = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);

    const phoneCount = recentPhoneDaily.filter(
      (c) => c.createdAt >= dayStart && c.createdAt <= dayEnd
    ).length;
    const anonCount = recentAnonDaily.filter(
      (c) => c.createdAt >= dayStart && c.createdAt <= dayEnd
    ).length;

    const dayName = dayStart.toLocaleDateString("en-IN", { weekday: "short" });
    const shortDate = dayStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    initialDailyGrowth.push({
      date: dayStart.toISOString().split("T")[0],
      day: dayName,
      shortDate,
      label: i === 0 ? "Today" : i === 1 ? "Yesterday" : dayName,
      count: phoneCount + anonCount,
      phoneCount,
      anonCount,
    });
  }

  const initialMonthlyGrowth = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1, 0, 0, 0, 0);

    const phoneCount = recentPhoneMonthly.filter(
      (c) => c.createdAt >= monthStart && c.createdAt < monthEnd
    ).length;
    const anonCount = recentAnonMonthly.filter(
      (c) => c.createdAt >= monthStart && c.createdAt < monthEnd
    ).length;

    const monthLabel = monthStart.toLocaleDateString("en-IN", { month: "short" });
    const fullMonth = monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    initialMonthlyGrowth.push({
      month: monthLabel,
      label: monthLabel,
      fullMonth,
      year: monthStart.getFullYear(),
      count: phoneCount + anonCount,
      phoneCount,
      anonCount,
    });
  }

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
        name: c.name || "Valued Diner",
        phone: c.phone,
        visits: Math.max(1, c.lifetimeStamps || c.currentStamps),
        stamps: c.currentStamps,
        lastVisit: c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : "Today",
        activeRewards: c.rewards,
      }))}
      recentActivity={recentActivity}
      initialDailyGrowth={initialDailyGrowth}
      initialMonthlyGrowth={initialMonthlyGrowth}
      qrSlug={primaryQr?.slug}
    />
  );
}
