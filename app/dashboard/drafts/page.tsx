import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { Empty } from "@/components/Shell";
import { StarsStatic } from "@/components/Stars";

export const dynamic = "force-dynamic";

export default async function Drafts() {
  const { restaurant } = (await getOwnerContext())!;
  const rows = await db.draft.findMany({
    where: { session: { qr: { restaurantId: restaurant.id } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { session: true },
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Previous review drafts</h1>
        <p className="text-ink/70">
          Earlier drafts are kept here for reference. New guest feedback uses rating-based
          suggestions instead of AI-written reviews.
        </p>
      </div>
      {rows.length === 0 ? (
        <Empty title="No previous drafts" body="New QR feedback is collected in Guest Feedback." />
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <li key={d.id} className="panel p-4">
              <div className="flex items-center justify-between text-sm">
                <StarsStatic n={d.session.overallRating} />
                <span className="text-ink/60">{d.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
              </div>
              <p className="mt-2 text-sm">{d.editedText ?? d.text}</p>
              <p className="mt-2 text-xs text-ink/60">
                {d.googleClickedAt ? "Continued to Google" : "Did not continue to Google"}{d.editedText ? " · Edited by guest" : ""}{d.regenerations ? ` · Regenerated ${d.regenerations}×` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
