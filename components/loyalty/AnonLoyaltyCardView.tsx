"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

export type AnonymousReward = {
  id: string;
  code: string;
  rewardTitle: string;
  discountAmount: number;
  status: "UNREDEEMED" | "REDEEMED" | "EXPIRED";
  expiresAt: string;
  redeemedAt: string | null;
};

export type AnonymousTransaction = {
  id: string;
  amount: number;
  type: "ISSUE" | "REVERSE";
  staffNote: string | null;
  createdAt: string;
};

export type AnonymousLoyaltyData = {
  restaurant: {
    id: string;
    name: string;
    logoUrl: string | null;
    brandColor: string;
  };
  program: {
    id: string;
    title: string;
    discountType?: string;
    stampsRequired: number;
    minBillAmount: number;
    rewardTitle: string;
    rewardDiscount: number;
    rewardExpiryDays: number;
    isActive: boolean;
  };
  customer: {
    id: string;
    status: string;
    currentStamps: number;
    lifetimeStamps: number;
    cycleNumber: number;
    lastVisitAt: string | null;
    rewards: AnonymousReward[];
    transactions: AnonymousTransaction[];
  };
  calculation?: {
    billAmountRupees: number;
    qualifies: boolean;
    minBillAmountRupees: number;
    discountAmountRupees: number;
    netPayableRupees: number;
    amountNeededForOfferRupees: number;
  } | null;
  isNewSession?: boolean;
};

export function AnonLoyaltyCardView({ slug }: { slug: string }) {
  const [data, setData] = useState<AnonymousLoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"card" | "rewards" | "history">("card");

  // Voucher QR Modal state
  const [selectedRewardQr, setSelectedRewardQr] = useState<string | null>(null);
  const [selectedRewardCode, setSelectedRewardCode] = useState<string | null>(null);
  const [selectedRewardTitle, setSelectedRewardTitle] = useState<string | null>(null);
  const [selectedRewardDiscount, setSelectedRewardDiscount] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Dynamic Diner Bill Calculator
  const [dinerBillInput, setDinerBillInput] = useState<string>("");

  useEffect(() => {
    fetchCard();
  }, [slug]);

  async function fetchCard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/loyalty/anon/card?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to load loyalty rewards");
      }
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Could not load loyalty card. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function showRewardQr(code: string, title?: string, discountPaise?: number) {
    setSelectedRewardTitle(title || "Dining Reward");
    setSelectedRewardDiscount(discountPaise ? discountPaise / 100 : 0);
    setSelectedRewardCode(code);
    setCopiedCode(false);

    try {
      const qrDataUrl = await QRCode.toDataURL(code, {
        width: 260,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setSelectedRewardQr(qrDataUrl);
    } catch {
      setSelectedRewardQr(null);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  const brandColor = data?.restaurant.brandColor || "#1F6F5C";
  const stampsRequired = data?.program.stampsRequired || 1;
  const currentStamps = data?.customer.currentStamps || 0;
  const progressPercent = Math.min(100, Math.round((currentStamps / stampsRequired) * 100));
  const stampsRemaining = Math.max(0, stampsRequired - currentStamps);
  const activeRewards = data?.customer.rewards.filter((r) => r.status === "UNREDEEMED") || [];

  const minBillRupees = data ? data.program.minBillAmount / 100 : 0;
  const isPercent = data?.program.discountType === "PERCENT";
  const discountDisplay = data
    ? isPercent
      ? `${data.program.rewardDiscount}%`
      : `₹${(data.program.rewardDiscount / 100).toFixed(0)}`
    : "";

  // Dynamic bill calculator for guest
  const numericBill = Number(dinerBillInput) || 0;
  const dinerMeetsMin = numericBill >= minBillRupees;
  const calculatedSavings = dinerMeetsMin
    ? isPercent
      ? Math.round((numericBill * (data?.program.rewardDiscount || 0)) / 100)
      : Math.min(numericBill, (data?.program.rewardDiscount || 0) / 100)
    : 0;
  const netPayable = Math.max(0, numericBill - calculatedSavings);

  return (
    <div className="min-h-screen bg-stone-50 pb-16 font-sans text-stone-900 antialiased selection:bg-stone-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link
            href={`/r/${slug}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 transition hover:text-stone-900"
          >
            <span>←</span> Back to Review
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-stone-500">Anonymous Dining Pass</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        {/* Loading Skeleton */}
        {loading && !data ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-stone-200/60 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-stone-200" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-stone-200" />
                <div className="h-3 w-20 rounded bg-stone-100" />
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm space-y-4 animate-pulse">
              <div className="h-6 w-3/4 rounded bg-stone-200" />
              <div className="h-4 w-1/2 rounded bg-stone-100" />
              <div className="grid grid-cols-5 gap-2 pt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl bg-stone-100" />
                ))}
              </div>
            </div>
            <p className="text-center text-xs font-medium text-stone-400">Loading your private stamp card...</p>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <div className="text-3xl">⚠️</div>
            <h2 className="mt-2 text-base font-bold text-stone-900">Unable to load card</h2>
            <p className="mt-1 text-xs text-stone-600">{error}</p>
            <button
              onClick={fetchCard}
              className="mt-4 rounded-xl bg-stone-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
            >
              Try Again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Restaurant Profile Mini Header */}
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-xs border border-stone-200/60">
              <div className="flex items-center gap-3">
                {data.restaurant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.restaurant.logoUrl}
                    alt={data.restaurant.name}
                    className="h-10 w-10 rounded-full border border-stone-200 object-cover"
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white shadow-sm"
                    style={{ backgroundColor: brandColor }}
                  >
                    {data.restaurant.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-bold text-stone-900 leading-tight">
                    {data.restaurant.name}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-stone-600">
                      ID: {data.customer.id.slice(0, 12)}…
                    </span>
                    <button
                      onClick={() => handleCopy(data.customer.id)}
                      className="text-[10px] font-semibold text-stone-400 hover:text-stone-700 underline"
                      title="Copy full anonymous ID"
                    >
                      {copiedCode ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy badge */}
              <div className="flex flex-col items-end text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <span>🔒</span> Anonymous
                </span>
                <span className="text-[9px] text-stone-400 mt-0.5">No phone number</span>
              </div>
            </div>

            {/* Privacy Notification Banner */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-stone-200 bg-white/70 p-3 shadow-xs backdrop-blur-xs">
              <span className="text-sm">🍪</span>
              <div className="text-[11px] leading-relaxed text-stone-600">
                <span className="font-semibold text-stone-800">Private Browser Card:</span> Your stamps are securely linked to this browser via cookie. No mobile number or registration needed.
              </div>
            </div>

            {/* DYNAMIC ACTIVE OFFER HERO BANNER */}
            {data.program.isActive && (
              <div className="rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-50/50 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300">
                    <span>☕</span>
                    <span>Active Dining Offer</span>
                  </span>
                  <span className="text-xs font-black text-amber-800">
                    Save {discountDisplay}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="font-display text-xl font-extrabold text-stone-900 leading-snug">
                    {data.program.rewardTitle}
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    Earn {stampsRequired} stamp{stampsRequired > 1 ? "s" : ""} on bills of ₹{minBillRupees.toFixed(0)} or more to unlock your dining voucher!
                  </p>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex rounded-xl bg-stone-200/70 p-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab("card")}
                className={`flex-1 rounded-lg py-2 transition ${
                  activeTab === "card"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Stamp Card ({currentStamps}/{stampsRequired})
              </button>
              <button
                onClick={() => setActiveTab("rewards")}
                className={`relative flex-1 rounded-lg py-2 transition ${
                  activeTab === "rewards"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                My Vouchers
                {activeRewards.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {activeRewards.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 rounded-lg py-2 transition ${
                  activeTab === "history"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Visits
              </button>
            </div>

            {/* TAB: STAMP CARD */}
            {activeTab === "card" && (
              <div className="space-y-4">
                {/* Main Digital Stamp Card Box */}
                <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Cycle #{data.customer.cycleNumber}
                      </span>
                      <h4 className="text-base font-extrabold text-stone-900">
                        {currentStamps >= stampsRequired ? "Reward Unlocked! 🎉" : "Collect Stamps"}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black" style={{ color: brandColor }}>
                        {currentStamps}
                      </span>
                      <span className="text-xs font-semibold text-stone-400">
                        /{stampsRequired}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: brandColor,
                      }}
                    />
                  </div>

                  {/* Stamps Grid */}
                  <div className="mt-6 grid grid-cols-5 gap-2.5">
                    {Array.from({ length: stampsRequired }).map((_, index) => {
                      const isStamped = index < currentStamps;
                      const isNext = index === currentStamps;
                      const isLast = index === stampsRequired - 1;

                      return (
                        <div
                          key={index}
                          className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all ${
                            isStamped
                              ? "border-transparent text-white shadow-xs scale-[1.02]"
                              : isNext
                              ? "border-dashed border-stone-400 bg-stone-50 text-stone-400 animate-pulse"
                              : "border-stone-200 bg-stone-50/50 text-stone-300"
                          }`}
                          style={{
                            backgroundColor: isStamped ? brandColor : undefined,
                          }}
                        >
                          {isStamped ? (
                            <span className="text-xl">⭐</span>
                          ) : isLast ? (
                            <span className="text-xl">🎁</span>
                          ) : (
                            <span className="text-xs font-bold font-mono">{index + 1}</span>
                          )}

                          {isNext && (
                            <span className="absolute -bottom-1 rounded-full bg-stone-800 px-1 text-[8px] font-bold text-white">
                              NEXT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* How it works info */}
                  <div className="mt-6 rounded-2xl bg-stone-50 p-3.5 text-center">
                    {stampsRemaining > 0 ? (
                      <p className="text-xs font-medium text-stone-600">
                        Ask staff to verify your bill to earn{" "}
                        <span className="font-bold text-stone-900">
                          {stampsRemaining} more stamp{stampsRemaining > 1 ? "s" : ""}
                        </span>{" "}
                        and receive <span className="font-bold text-stone-900">{data.program.rewardTitle}</span>!
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-emerald-700">
                          🎉 Stamp goal achieved! Your voucher is ready to redeem.
                        </p>
                        <button
                          onClick={() => setActiveTab("rewards")}
                          className="text-xs font-bold underline text-stone-900"
                        >
                          View Voucher &amp; Show to Staff →
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Diner Bill Savings Calculator */}
                <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧮</span>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      Check Your Bill Savings
                    </h5>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    See how much you save on your bill today with this offer.
                  </p>

                  <div className="mt-3 flex items-center rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 focus-within:border-stone-800 focus-within:bg-white transition">
                    <span className="text-xs font-bold text-stone-500 mr-2">₹</span>
                    <input
                      type="number"
                      placeholder={`Enter bill amount (e.g. ${minBillRupees || 500})`}
                      value={dinerBillInput}
                      onChange={(e) => setDinerBillInput(e.target.value)}
                      className="w-full bg-transparent text-xs font-medium text-stone-900 outline-none"
                    />
                  </div>

                  {numericBill > 0 && (
                    <div className="mt-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3 text-xs space-y-1.5">
                      <div className="flex justify-between text-stone-600">
                        <span>Qualifying Minimum:</span>
                        <span className="font-semibold">₹{minBillRupees.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Offer Status:</span>
                        <span
                          className={`font-bold ${
                            dinerMeetsMin ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {dinerMeetsMin
                            ? "✅ Qualifies for Offer Stamp"
                            : `Add ₹${(minBillRupees - numericBill).toFixed(0)} more to qualify`}
                        </span>
                      </div>
                      {dinerMeetsMin && (
                        <>
                          <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-stone-200">
                            <span>Voucher Discount:</span>
                            <span>-₹{calculatedSavings.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-stone-900">
                            <span>Estimated Net Payable:</span>
                            <span>₹{netPayable.toFixed(0)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Staff Stamp Instructions */}
                <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
                  <h5 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <span>🧾</span> How Staff Awards Stamps
                  </h5>
                  <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                    Show your bill to the restaurant staff. Staff enters your invoice reference into the loyalty tool to add your stamp.
                  </p>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
                    <span className="text-[11px] font-mono text-stone-600">
                      Customer Ref: {data.customer.id}
                    </span>
                    <button
                      onClick={() => handleCopy(data.customer.id)}
                      className="rounded-lg bg-stone-200 px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-300 transition"
                    >
                      {copiedCode ? "Copied!" : "Copy Ref"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: VOUCHERS / REWARDS */}
            {activeTab === "rewards" && (
              <div className="space-y-4">
                {activeRewards.length === 0 ? (
                  <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-xs">
                    <div className="text-3xl">🎟️</div>
                    <h4 className="mt-2 text-sm font-bold text-stone-900">
                      No Active Vouchers Yet
                    </h4>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-stone-500">
                      You need {stampsRemaining} more stamp{stampsRemaining > 1 ? "s" : ""} to unlock your first dining offer!
                    </p>
                    <button
                      onClick={() => setActiveTab("card")}
                      className="mt-4 rounded-xl py-2 px-4 text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: brandColor }}
                    >
                      View Stamp Progress →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Ready to Redeem ({activeRewards.length})
                    </h4>
                    {activeRewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 shadow-xs"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="inline-block rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                              VOUCHER
                            </span>
                            <h5 className="mt-1 text-base font-extrabold text-stone-900">
                              {reward.rewardTitle}
                            </h5>
                            <p className="text-[11px] text-stone-500">
                              Valid until {new Date(reward.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-amber-700">
                              ₹{(reward.discountAmount / 100).toFixed(0)} OFF
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-amber-200/80 pt-3">
                          <span className="font-mono text-xs font-bold tracking-wider text-stone-800">
                            {reward.code}
                          </span>
                          <button
                            onClick={() =>
                              showRewardQr(reward.code, reward.rewardTitle, reward.discountAmount)
                            }
                            className="rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:brightness-105"
                            style={{ backgroundColor: brandColor }}
                          >
                            Show QR to Staff →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Redeemed / Expired history */}
                {data.customer.rewards.some((r) => r.status !== "UNREDEEMED") && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                    <h5 className="text-xs font-bold text-stone-700">Past Vouchers</h5>
                    <div className="mt-2 divide-y divide-stone-100">
                      {data.customer.rewards
                        .filter((r) => r.status !== "UNREDEEMED")
                        .map((r) => (
                          <div key={r.id} className="flex items-center justify-between py-2 text-xs">
                            <div>
                              <p className="font-semibold text-stone-800">{r.rewardTitle}</p>
                              <p className="text-[10px] font-mono text-stone-400">{r.code}</p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                r.status === "REDEEMED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-stone-100 text-stone-500"
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: VISITS / STAMP HISTORY */}
            {activeTab === "history" && (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Stamp Activity History
                </h4>

                {data.customer.transactions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    No stamp visits recorded on this card yet.
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-stone-100">
                    {data.customer.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                            +{tx.amount}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-stone-800">
                              {tx.type === "ISSUE" ? "Stamp Awarded" : "Stamp Adjustment"}
                            </p>
                            <p className="text-[10px] text-stone-400">
                              {new Date(tx.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {tx.staffNote && (
                          <span className="text-[10px] text-stone-500 max-w-[120px] truncate">
                            {tx.staffNote}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Voucher QR Code Modal */}
      {selectedRewardCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                🎁 Redeem at Counter
              </span>
              <button
                onClick={() => setSelectedRewardCode(null)}
                className="text-stone-400 hover:text-stone-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <h4 className="mt-3 text-lg font-bold text-stone-900">{selectedRewardTitle}</h4>
            {selectedRewardDiscount > 0 && (
              <p className="text-xs font-black text-amber-700">
                Flat ₹{selectedRewardDiscount.toFixed(0)} Discount
              </p>
            )}

            {/* QR Image */}
            <div className="my-4 flex justify-center">
              {selectedRewardQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedRewardQr}
                  alt={`Voucher ${selectedRewardCode}`}
                  className="h-56 w-56 rounded-2xl border border-stone-200 p-2 shadow-inner"
                />
              ) : (
                <div className="h-56 w-56 rounded-2xl bg-stone-100 flex items-center justify-center text-xs text-stone-400">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="rounded-xl bg-stone-50 p-2.5">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                Voucher Code
              </span>
              <span className="font-mono text-base font-black text-stone-900 tracking-wider">
                {selectedRewardCode}
              </span>
            </div>

            <p className="mt-3 text-[11px] text-stone-500 leading-tight">
              Show this code to the server or cashier to apply your dining discount.
            </p>

            <button
              onClick={() => setSelectedRewardCode(null)}
              className="mt-4 w-full rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
