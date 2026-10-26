"use client";

import { useState, useMemo } from "react";
import { StarsStatic } from "@/components/Stars";
import { Empty } from "@/components/Shell";

type FeedbackItem = {
  id: string;
  overallRating: number;
  foodRating: number | null;
  serviceRating: number | null;
  chips: string[];
  freeText: string | null;
  completedAt: string;
  qr: {
    id: string;
    name: string;
  };
};

type QrOption = {
  id: string;
  name: string;
};

export function FeedbackFilterableList({
  feedbacks,
  qrCodes,
}: {
  feedbacks: FeedbackItem[];
  qrCodes: QrOption[];
}) {
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [qrFilter, setQrFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const filtered = useMemo(() => {
    return feedbacks.filter((f) => {
      // Rating filter
      if (ratingFilter === "positive" && f.overallRating < 4) return false;
      if (ratingFilter === "neutral" && f.overallRating !== 3) return false;
      if (ratingFilter === "negative" && f.overallRating > 2) return false;
      if (ratingFilter !== "all" && !["positive", "neutral", "negative"].includes(ratingFilter)) {
        const exact = Number(ratingFilter);
        if (!isNaN(exact) && f.overallRating !== exact) return false;
      }

      // QR filter
      if (qrFilter !== "all" && f.qr.id !== qrFilter) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesText = f.freeText?.toLowerCase().includes(q);
        const matchesChips = f.chips.some((chip) => chip.toLowerCase().includes(q));
        const matchesQr = f.qr.name.toLowerCase().includes(q);
        if (!matchesText && !matchesChips && !matchesQr) return false;
      }

      return true;
    });
  }, [feedbacks, ratingFilter, qrFilter, search]);

  const ratingCounts = useMemo(() => {
    return {
      all: feedbacks.length,
      positive: feedbacks.filter((f) => f.overallRating >= 4).length,
      neutral: feedbacks.filter((f) => f.overallRating === 3).length,
      negative: feedbacks.filter((f) => f.overallRating <= 2).length,
      star5: feedbacks.filter((f) => f.overallRating === 5).length,
      star4: feedbacks.filter((f) => f.overallRating === 4).length,
      star3: feedbacks.filter((f) => f.overallRating === 3).length,
      star2: feedbacks.filter((f) => f.overallRating === 2).length,
      star1: feedbacks.filter((f) => f.overallRating === 1).length,
    };
  }, [feedbacks]);

  return (
    <div className="space-y-5">
      {/* Filter and Search Bar */}
      <div className="space-y-3 rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle">
        {/* Rating Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: `All (${ratingCounts.all})` },
            { id: "positive", label: `Positive 4-5★ (${ratingCounts.positive})` },
            { id: "neutral", label: `Neutral 3★ (${ratingCounts.neutral})` },
            { id: "negative", label: `Critical 1-2★ (${ratingCounts.negative})` },
            { id: "5", label: `5★ (${ratingCounts.star5})` },
            { id: "4", label: `4★ (${ratingCounts.star4})` },
            { id: "3", label: `3★ (${ratingCounts.star3})` },
            { id: "2", label: `2★ (${ratingCounts.star2})` },
            { id: "1", label: `1★ (${ratingCounts.star1})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRatingFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                ratingFilter === tab.id
                  ? "bg-[#24211E] text-white shadow-xs"
                  : "bg-[#FAF7F2] text-[#716B64] border border-[#E8DFD1] hover:bg-[#F2ECE1] hover:text-[#24211E]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* QR Dropdown and Search */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <input
            type="search"
            placeholder="Search feedback comments, food items, chips…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-sm rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
          />

          {qrCodes.length > 1 && (
            <select
              value={qrFilter}
              onChange={(e) => setQrFilter(e.target.value)}
              className="rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white cursor-pointer"
            >
              <option value="all">All QR Placements</option>
              {qrCodes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          )}

          {(search || ratingFilter !== "all" || qrFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setRatingFilter("all");
                setQrFilter("all");
              }}
              className="text-xs font-semibold text-[#B58A4B] hover:text-[#9E7438] underline px-2"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-[#716B64]">
        <span>
          Showing <strong className="text-[#24211E]">{filtered.length}</strong> of{" "}
          <strong className="text-[#24211E]">{feedbacks.length}</strong> guest responses
        </span>
      </div>

      {/* Feedbacks List */}
      {filtered.length === 0 ? (
        <Empty
          title="No feedback matches your filter"
          body="Try selecting a different rating or clearing your search term."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-subtle hover:border-[#B58A4B] transition">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <StarsStatic n={r.overallRating} />
                  <span className="font-serif font-bold text-xs text-[#24211E]">{r.overallRating}/5 Stars</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#716B64]">
                  <span className="rounded-md bg-[#FAF5ED] px-2 py-0.5 border border-[#E8D8BA] font-semibold text-[#7A5826]">
                    {r.qr.name}
                  </span>
                  <span>·</span>
                  <span>
                    {new Date(r.completedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>

              {(r.foodRating || r.serviceRating) && (
                <div className="mt-2.5 flex gap-4 text-xs text-[#716B64]">
                  {r.foodRating && <span>Food: <strong className="text-[#24211E]">{r.foodRating}★</strong></span>}
                  {r.serviceRating && <span>Service: <strong className="text-[#24211E]">{r.serviceRating}★</strong></span>}
                </div>
              )}

              {r.chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-[#FAF7F2] border border-[#E8DFD1] px-2.5 py-0.5 text-[11px] font-medium text-[#716B64]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {r.freeText && (
                <p className="mt-3 text-xs leading-relaxed italic text-[#24211E] bg-[#FAF5ED]/50 p-3 rounded-xl border border-[#E8D8BA]/50">
                  &ldquo;{r.freeText}&rdquo;
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
