import { getOwnerContext } from "@/lib/auth";
import { restaurantStats, buildInsights } from "@/lib/analytics";
import { Empty } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function Insights() {
  const { restaurant } = (await getOwnerContext())!;
  const s = await restaurantStats(restaurant.id, 30);
  const insights = buildInsights(s);
  return (
    <div className="space-y-6">
      <div className="border-b border-[#E8DFD1] pb-4">
        <h1 className="font-serif text-3xl font-bold text-[#24211E]">AI Insights</h1>
        <p className="mt-1 text-xs text-[#716B64]">Calculated from your guests&apos; responses in the last 30 days.</p>
      </div>
      {insights.length === 0 ? (
        <Empty
          title="Not enough responses yet"
          body={`Insights appear after 5 completed responses. You have ${s.sessions}.`}
        />
      ) : (
        <ul className="space-y-3">
          {insights.map((i) => (
            <li key={i} className="rounded-2xl border border-[#E8DFD1] bg-white p-5 text-xs text-[#24211E] shadow-subtle leading-relaxed flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FAF5ED] text-xs text-[#B58A4B] border border-[#E8D8BA]">
                💡
              </span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      )}
      {s.chips.length > 0 && (
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-6 shadow-subtle">
          <h2 className="font-serif text-base font-bold text-[#24211E]">What guests say they enjoyed</h2>
          <ul className="mt-4 divide-y divide-[#E8DFD1]/50 text-xs">
            {s.chips.map(([c, n]) => (
              <li key={c} className="flex justify-between py-2.5">
                <span className="font-medium text-[#24211E]">{c}</span>
                <span className="font-mono font-semibold text-[#B58A4B]">{n} mentions</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
