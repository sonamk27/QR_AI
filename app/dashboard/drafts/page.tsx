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
    <div className="space-y-6">
      <div className="border-b border-[#E8DFD1] pb-4">
        <h1 className="font-serif text-3xl font-bold text-[#24211E]">Previous Review Drafts</h1>
        <p className="mt-1 text-xs text-[#716B64]">
          Earlier drafts are kept here for reference. New guest feedback uses rating-based
          suggestions instead of AI-written reviews.
        </p>
      </div>
      {rows.length === 0 ? (
        <Empty title="No previous drafts" body="New QR feedback is collected in Guest Feedback." />
      ) : (
        <ul className="space-y-3">
          {rows.map((d: any) => (
            <li key={d.id} className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-subtle hover:border-[#B58A4B] transition">
              <div className="flex items-center justify-between text-xs">
                <StarsStatic n={d.session.overallRating} />
                <span className="text-[#716B64] font-medium">{d.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed italic text-[#24211E] bg-[#FAF5ED]/50 p-3 rounded-xl border border-[#E8D8BA]/50">
                &ldquo;{d.editedText ?? d.text}&rdquo;
              </p>
              <p className="mt-3 text-[11px] text-[#716B64]">
                {d.googleClickedAt ? "✓ Continued to Google" : "Did not continue to Google"}
                {d.editedText ? " · Edited by guest" : ""}
                {d.regenerations ? ` · Regenerated ${d.regenerations}×` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
