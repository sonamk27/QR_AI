import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { FeedbackFilterableList } from "@/components/FeedbackFilterableList";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const { restaurant } = (await getOwnerContext())!;

  const [feedbacks, qrCodes] = await Promise.all([
    db.feedbackSession.findMany({
      where: { qr: { restaurantId: restaurant.id } },
      orderBy: { completedAt: "desc" },
      take: 200,
      include: { qr: { select: { id: true, name: true } } },
    }),
    db.qrCode.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const serializedFeedbacks = feedbacks.map((f) => ({
    id: f.id,
    overallRating: f.overallRating,
    foodRating: f.foodRating,
    serviceRating: f.serviceRating,
    chips: f.chips,
    freeText: f.freeText,
    completedAt: f.completedAt.toISOString(),
    qr: f.qr,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Guest Feedback</h1>
        <p className="mt-1 text-ink/70">
          Real guest ratings, food &amp; service impressions, and suggestions captured before Google redirection.
        </p>
      </div>

      <FeedbackFilterableList
        feedbacks={serializedFeedbacks}
        qrCodes={qrCodes}
      />
    </div>
  );
}
