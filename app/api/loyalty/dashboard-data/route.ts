import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export type LiveActivityItem = {
  id: string;
  type: "STAMP_REQUEST" | "STAMP_APPROVED" | "STAMP_REJECTED" | "MANUAL_STAMP" | "REWARD_UNLOCKED" | "REWARD_REDEEMED" | "CUSTOMER_JOINED" | "FEEDBACK";
  title: string;
  description: string;
  customerName: string;
  customerPhone: string | null;
  icon: string;
  badge?: string;
  badgeColor?: "amber" | "emerald" | "rose" | "blue" | "purple";
  createdAt: string;
  tableNo?: string | null;
  code?: string | null;
  amount?: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const ownerCtx = await getOwnerContext();
    if (!ownerCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurantId = ownerCtx.restaurant.id;
    const program = await getOrCreateLoyaltyProgram(restaurantId);

    // 1. Live Stats Counts
    const [
      phoneCustomersCount,
      anonCustomersCount,
      totalTransactionsCount,
      unredeemedRewardsCount,
      redeemedRewardsCount,
      pendingStampRequestsCount,
      feedbackSessionsCount,
    ] = await Promise.all([
      db.loyaltyCustomer.count({ where: { programId: program.id } }),
      db.anonymousCustomer.count({ where: { restaurantId } }),
      db.loyaltyTransaction.count({ where: { programId: program.id } }),
      db.loyaltyReward.count({ where: { programId: program.id, status: "UNREDEEMED" } }),
      db.loyaltyReward.count({ where: { programId: program.id, status: "REDEEMED" } }),
      db.stampRequest.count({ where: { restaurantId, status: "PENDING" } }),
      db.feedbackSession.count({ where: { qr: { restaurantId } } }),
    ]);

    // 2. Fetch Recent Customers (up to 20)
    const rawCustomers = await db.loyaltyCustomer.findMany({
      where: { programId: program.id },
      orderBy: [{ lastVisitAt: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        rewards: {
          where: { status: "UNREDEEMED" },
          select: { id: true, code: true, rewardTitle: true, expiresAt: true },
        },
      },
    });

    const customers = rawCustomers.map((c) => ({
      id: c.id,
      name: c.name || "Valued Diner",
      phone: c.phone,
      visits: Math.max(1, c.lifetimeStamps || c.currentStamps),
      stamps: c.currentStamps,
      lifetimeStamps: c.lifetimeStamps,
      lastVisit: c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "Today",
      lastVisitRaw: c.lastVisitAt || c.createdAt,
      activeRewards: c.rewards,
    }));

    // 3. Fetch Unified Live Activities (Customer-Owner interactions)
    const [stampRequests, transactions, rewards, feedbacks] = await Promise.all([
      // Stamp requests (Pending, Approved, Declined)
      db.stampRequest.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      // Loyalty Transactions
      db.loyaltyTransaction.findMany({
        where: { programId: program.id },
        include: {
          customer: {
            select: { name: true, phone: true, currentStamps: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      // Rewards (Unlocked and Redeemed)
      db.loyaltyReward.findMany({
        where: { programId: program.id },
        include: {
          customer: {
            select: { name: true, phone: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Feedback Sessions
      db.feedbackSession.findMany({
        where: { qr: { restaurantId } },
        include: {
          qr: { select: { tableNo: true, name: true } },
        },
        orderBy: { completedAt: "desc" },
        take: 10,
      }),
    ]);

    // Build unified activity items
    const activityItems: LiveActivityItem[] = [];

    // Add Stamp Requests
    for (const req of stampRequests) {
      if (req.status === "PENDING") {
        activityItems.push({
          id: `req-pend-${req.id}`,
          type: "STAMP_REQUEST",
          title: "Stamp Request Received",
          description: `Customer requested a visit stamp from ${req.tableNo || "table QR"}`,
          customerName: req.customerName || "Diner",
          customerPhone: req.customerPhone || "Anonymous",
          icon: "🔔",
          badge: "Awaiting Approval",
          badgeColor: "amber",
          createdAt: req.createdAt.toISOString(),
          tableNo: req.tableNo,
        });
      } else if (req.status === "APPROVED") {
        activityItems.push({
          id: `req-appr-${req.id}`,
          type: "STAMP_APPROVED",
          title: "Visit Stamp Approved",
          description: `Owner approved 1 stamp for ${req.customerName || req.customerPhone || "customer"} (${req.tableNo || "visit"})`,
          customerName: req.customerName || "Diner",
          customerPhone: req.customerPhone || "Anonymous",
          icon: "✅",
          badge: "+1 Stamp",
          badgeColor: "emerald",
          createdAt: (req.reviewedAt || req.createdAt).toISOString(),
          tableNo: req.tableNo,
        });
      } else if (req.status === "REJECTED") {
        activityItems.push({
          id: `req-rej-${req.id}`,
          type: "STAMP_REJECTED",
          title: "Stamp Request Declined",
          description: `Owner declined request from ${req.customerName || req.customerPhone || "customer"}`,
          customerName: req.customerName || "Diner",
          customerPhone: req.customerPhone || "Anonymous",
          icon: "✕",
          badge: "Declined",
          badgeColor: "rose",
          createdAt: (req.reviewedAt || req.createdAt).toISOString(),
          tableNo: req.tableNo,
        });
      }
    }

    // Add Transactions
    for (const tx of transactions) {
      if (tx.stampsCount > 0 && !tx.staffNote?.includes("Approved")) {
        activityItems.push({
          id: `tx-${tx.id}`,
          type: "MANUAL_STAMP",
          title: "Stamp Awarded",
          description: tx.staffNote || "Visit stamp awarded to diner",
          customerName: tx.customer.name || "Diner",
          customerPhone: tx.customer.phone || null,
          icon: "☕",
          badge: "+1 Stamp",
          badgeColor: "emerald",
          createdAt: tx.createdAt.toISOString(),
        });
      }
    }

    // Add Rewards
    for (const r of rewards) {
      if (r.status === "REDEEMED") {
        activityItems.push({
          id: `rew-red-${r.id}`,
          type: "REWARD_REDEEMED",
          title: "Voucher Redeemed",
          description: `Voucher ${r.code} redeemed (${r.rewardTitle})`,
          customerName: r.customer.name || "Diner",
          customerPhone: r.customer.phone || null,
          icon: "🎟️",
          badge: "Redeemed",
          badgeColor: "purple",
          createdAt: (r.redeemedAt || r.createdAt).toISOString(),
          code: r.code,
        });
      } else {
        activityItems.push({
          id: `rew-unl-${r.id}`,
          type: "REWARD_UNLOCKED",
          title: "Reward Unlocked 🎉",
          description: `Customer reached target stamps and unlocked ${r.rewardTitle}`,
          customerName: r.customer.name || "Diner",
          customerPhone: r.customer.phone || null,
          icon: "🎁",
          badge: "Unlocked",
          badgeColor: "amber",
          createdAt: r.createdAt.toISOString(),
          code: r.code,
        });
      }
    }

    // Add Feedbacks
    for (const fb of feedbacks) {
      activityItems.push({
        id: `fb-${fb.id}`,
        type: "FEEDBACK",
        title: `${fb.overallRating}★ Rating & Feedback`,
        description: fb.freeText || (fb.chips && fb.chips.length > 0 ? fb.chips.join(", ") : "Guest shared dining feedback"),
        customerName: "Diner",
        customerPhone: fb.qr?.name || null,
        icon: "⭐",
        badge: `${fb.overallRating} Stars`,
        badgeColor: fb.overallRating >= 4 ? "emerald" : "amber",
        createdAt: fb.completedAt.toISOString(),
        tableNo: fb.qr?.tableNo ? `Table ${fb.qr.tableNo}` : fb.qr?.name,
      });
    }

    // Sort all activities chronologically (newest first) and deduplicate
    const sortedActivity = activityItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 25);

    // 4. Calculate Customer Growth (Day-wise & Month-wise) from actual database records
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);

    const [
      recentPhoneCustomersDaily,
      recentAnonCustomersDaily,
      recentPhoneCustomersMonthly,
      recentAnonCustomersMonthly,
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

    // Build Day-wise growth (past 30 days)
    const dailyGrowth = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);

      const phoneCount = recentPhoneCustomersDaily.filter(
        (c) => c.createdAt >= dayStart && c.createdAt <= dayEnd
      ).length;
      const anonCount = recentAnonCustomersDaily.filter(
        (c) => c.createdAt >= dayStart && c.createdAt <= dayEnd
      ).length;

      const dayName = dayStart.toLocaleDateString("en-IN", { weekday: "short" });
      const shortDate = dayStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const dateStr = dayStart.toISOString().split("T")[0];

      dailyGrowth.push({
        date: dateStr,
        day: dayName,
        shortDate,
        label: i === 0 ? "Today" : i === 1 ? "Yesterday" : dayName,
        count: phoneCount + anonCount,
        phoneCount,
        anonCount,
      });
    }

    // Build Month-wise growth (past 12 months)
    const monthlyGrowth = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1, 0, 0, 0, 0);

      const phoneCount = recentPhoneCustomersMonthly.filter(
        (c) => c.createdAt >= monthStart && c.createdAt < monthEnd
      ).length;
      const anonCount = recentAnonCustomersMonthly.filter(
        (c) => c.createdAt >= monthStart && c.createdAt < monthEnd
      ).length;

      const monthLabel = monthStart.toLocaleDateString("en-IN", { month: "short" });
      const fullMonth = monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const year = monthStart.getFullYear();

      monthlyGrowth.push({
        month: monthLabel,
        label: monthLabel,
        fullMonth,
        year,
        count: phoneCount + anonCount,
        phoneCount,
        anonCount,
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalCustomers: phoneCustomersCount + anonCustomersCount,
        totalTransactions: totalTransactionsCount,
        unredeemedRewards: unredeemedRewardsCount,
        redeemedRewards: redeemedRewardsCount,
        pendingStampRequests: pendingStampRequestsCount,
        reviewClicks: feedbackSessionsCount,
      },
      customers,
      recentActivity: sortedActivity,
      dailyGrowth,
      monthlyGrowth,
      program: {
        id: program.id,
        title: program.title,
        isActive: program.isActive,
        discountType: program.discountType || "PERCENT",
        stampsRequired: program.stampsRequired,
        minBillAmount: program.minBillAmount,
        rewardTitle: program.rewardTitle,
        rewardDiscount: program.rewardDiscount,
        rewardExpiryDays: program.rewardExpiryDays,
      },
    });
  } catch (error: any) {
    console.error("[loyalty/dashboard-data] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch loyalty dashboard data" },
      { status: 500 }
    );
  }
}
