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
        <h1 className="text-3xl font-semibold">Review drafts</h1>
        <p className="text-ink/70">Drafts written for guests. “Continued to Google” means the guest tapped the button. Only Google knows if a review was posted.</p>
      </div>
      {rows.length === 0 ? (
        <Empty title="No drafts yet" body="A draft is created each time a guest finishes the flow." />
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
