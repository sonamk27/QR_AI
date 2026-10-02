import { getOwnerContext } from "@/lib/auth";
import { restaurantStats, buildInsights } from "@/lib/analytics";
import { Empty } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function Insights() {
  const { restaurant } = (await getOwnerContext())!;
  const s = await restaurantStats(restaurant.id, 30);
  const insights = buildInsights(s);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Insights</h1>
        <p className="text-ink/70">Calculated from your guests' responses in the last 30 days.</p>
      </div>
      {insights.length === 0 ? (
        <Empty title="Not enough responses yet" body={`Insights appear after 5 completed responses. You have ${s.sessions}.`} />
      ) : (
        <ul className="space-y-3">{insights.map((i) => <li key={i} className="panel p-4 text-sm">{i}</li>)}</ul>
      )}
      {s.chips.length > 0 && (
        <div className="panel p-5">
          <h2 className="font-semibold">What guests say they enjoyed</h2>
          <ul className="mt-3 space-y-1 text-sm">{s.chips.map(([c, n]) => <li key={c} className="flex justify-between"><span>{c}</span><span className="text-ink/60">{n}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
