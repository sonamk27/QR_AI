import { db } from "./db";

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

export async function restaurantStats(restaurantId: string, days = 30) {
  const qrWhere = { qr: { restaurantId } };
  const from = since(days);
  const [scans, sessions, avg, clicks, dist, chipRows] = await Promise.all([
    db.scan.count({ where: { ...qrWhere, createdAt: { gte: from } } }),
    db.feedbackSession.count({ where: { ...qrWhere, completedAt: { gte: from } } }),
    db.feedbackSession.aggregate({
      where: { ...qrWhere, completedAt: { gte: from } },
      _avg: { overallRating: true, foodRating: true, serviceRating: true },
    }),
    db.draft.count({ where: { session: { ...qrWhere, completedAt: { gte: from } }, googleClickedAt: { not: null } } }),
    db.feedbackSession.groupBy({
      by: ["overallRating"],
      where: { ...qrWhere, completedAt: { gte: from } },
      _count: true,
    }),
    db.feedbackSession.findMany({
      where: { ...qrWhere, completedAt: { gte: from } },
      select: { chips: true },
      take: 5000,
    }),
  ]);
  const chips: Record<string, number> = {};
  chipRows.forEach((r) => r.chips.forEach((c) => (chips[c] = (chips[c] ?? 0) + 1)));
  const distribution = [1, 2, 3, 4, 5].map((n) => ({
    rating: n,
    count: dist.find((d) => d.overallRating === n)?._count ?? 0,
  }));
  return {
    scans,
    sessions,
    googleClicks: clicks,
    avgOverall: avg._avg.overallRating,
    avgFood: avg._avg.foodRating,
    avgService: avg._avg.serviceRating,
    distribution,
    chips: Object.entries(chips).sort((a, b) => b[1] - a[1]),
  };
}

/** Rule-based insights. Only produced when there is enough real data. */
export function buildInsights(s: Awaited<ReturnType<typeof restaurantStats>>) {
  const out: string[] = [];
  if (s.sessions < 5) return out;
  if (s.avgFood != null && s.avgService != null) {
    if (s.avgFood - s.avgService >= 0.4) out.push(`Food (${s.avgFood.toFixed(1)}) is rated higher than service (${s.avgService.toFixed(1)}).`);
    else if (s.avgService - s.avgFood >= 0.4) out.push(`Service (${s.avgService.toFixed(1)}) is rated higher than food (${s.avgFood.toFixed(1)}).`);
    else out.push(`Food and service are rated about the same (${s.avgFood.toFixed(1)} and ${s.avgService.toFixed(1)}).`);
  }
  if (s.chips[0]) out.push(`Customers most often pick "${s.chips[0][0]}" as what they enjoyed (${s.chips[0][1]} times).`);
  const low = s.distribution.filter((d) => d.rating <= 2).reduce((a, d) => a + d.count, 0);
  if (low > 0) out.push(`${low} of ${s.sessions} responses were 1-2 stars. Read them in Feedback.`);
  if (s.sessions > 0) out.push(`${Math.round((s.googleClicks / s.sessions) * 100)}% of completed responses continued to Google.`);
  return out;
}

export async function platformStats() {
  const now = new Date();
  const expiringBy = new Date(now.getTime() + 30 * 86_400_000);
  const [restaurants, activeRestaurants, qrActive, qrExpired, qrExpiringSoon, scans, sessions, clicks, revenue] = await Promise.all([
    db.restaurant.count(),
    db.restaurant.count({ where: { status: "ACTIVE" } }),
    db.qrCode.count({ where: { status: "ACTIVE" } }),
    db.qrCode.count({ where: { status: { in: ["GRACE", "EXPIRED"] } } }),
    db.qrCode.count({
      where: {
        status: { in: ["ACTIVE", "GRACE"] },
        validUntil: { gte: now, lte: expiringBy },
      },
    }),
    db.scan.count(),
    db.feedbackSession.count(),
    db.draft.count({ where: { googleClickedAt: { not: null } } }),
    db.payment.aggregate({
      where: { status: { in: ["CONFIRMED", "PAID"] } },
      _sum: { amount: true },
    }),
  ]);
  return {
    restaurants,
    activeRestaurants,
    qrActive,
    qrExpired,
    qrExpiringSoon,
    scans,
    sessions,
    clicks,
    revenue: revenue._sum.amount ?? 0,
  };
}
