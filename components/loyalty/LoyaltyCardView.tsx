"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

type LoyaltyReward = {
  id: string;
  code: string;
  rewardTitle: string;
  discountAmount: number;
  status: "UNREDEEMED" | "REDEEMED" | "EXPIRED";
  expiresAt: string;
  redeemedAt: string | null;
};

type LoyaltyTransaction = {
  id: string;
  stampsCount: number;
  billAmount: number | null;
  billReference: string | null;
  createdAt: string;
};

type LoyaltyCardData = {
  restaurant: {
    id: string;
    name: string;
    logoUrl: string | null;
    brandColor: string;
  };
  program: {
    id: string;
    title: string;
    stampsRequired: number;
    minBillAmount: number;
    rewardTitle: string;
    rewardDiscount: number;
    rewardExpiryDays: number;
  };
  customer: {
    id: string;
    phone: string;
    name: string | null;
    currentStamps: number;
    lifetimeStamps: number;
    rewards: LoyaltyReward[];
    transactions: LoyaltyTransaction[];
  };
};

export function LoyaltyCardView({ slug }: { slug: string }) {
  const [phone, setPhone] = useState("");
  const [inputPhone, setInputPhone] = useState("");
  const [inputName, setInputName] = useState("");
  const [data, setData] = useState<LoyaltyCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"card" | "rewards" | "history">("card");
  const [selectedRewardQr, setSelectedRewardQr] = useState<string | null>(null);
  const [selectedRewardCode, setSelectedRewardCode] = useState<string | null>(null);

  // Load remembered phone from localStorage
  useEffect(() => {
    const savedPhone = localStorage.getItem(`loyalty_phone_${slug}`);
    if (savedPhone) {
      setPhone(savedPhone);
      fetchCard(savedPhone);
    }
  }, [slug]);

  async function fetchCard(userPhone: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/loyalty/card?slug=${slug}&phone=${encodeURIComponent(userPhone)}`);
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to load loyalty card");
      }
      setData(result);
      localStorage.setItem(`loyalty_phone_${slug}`, userPhone);
    } catch (err: any) {
      setError(err.message || "Failed to load card");
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const clean = inputPhone.replace(/\D/g, "");
    if (clean.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    const finalPhone = clean.length > 10 && clean.startsWith("91") ? clean.slice(2) : clean;
    setPhone(finalPhone);
    fetchCard(finalPhone);
  }

  function handleSwitchAccount() {
    localStorage.removeItem(`loyalty_phone_${slug}`);
    setPhone("");
    setData(null);
    setInputPhone("");
  }

  async function showRewardQr(code: string) {
    try {
      const qrDataUrl = await QRCode.toDataURL(code, {
        width: 240,
        margin: 2,
        color: { dark: "#18181b", light: "#ffffff" },
      });
      setSelectedRewardQr(qrDataUrl);
      setSelectedRewardCode(code);
    } catch {
      setSelectedRewardCode(code);
    }
  }

  const brandColor = data?.restaurant.brandColor || "#1F6F5C";
  const stampsRequired = data?.program.stampsRequired || 10;
  const currentStamps = data?.customer.currentStamps || 0;
  const progressPercent = Math.min(100, Math.round((currentStamps / stampsRequired) * 100));
  const stampsRemaining = Math.max(0, stampsRequired - currentStamps);
  const activeRewards = data?.customer.rewards.filter((r) => r.status === "UNREDEEMED") || [];

  return (
    <div className="min-h-screen bg-stone-100/60 pb-12 font-sans text-stone-900 antialiased selection:bg-stone-200">
      {/* Header bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link
            href={`/r/${slug}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 transition hover:text-stone-900"
          >
            <span>←</span> Rate Experience
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-stone-500">Digital Loyalty Card</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        {/* If Not Logged In with Phone */}
        {!phone || (!data && !loading) ? (
          <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm">
            <div className="text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-inner"
                style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
              >
                ☕
              </div>
              <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-stone-900">
                Coffee & Dining Rewards
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Collect stamps on every purchase and earn exclusive discounts!
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                  Mobile Number
                </label>
                <div className="mt-1.5 flex rounded-xl border border-stone-200 bg-stone-50/50 shadow-inner focus-within:border-stone-800 focus-within:bg-white transition">
                  <span className="flex items-center pl-3.5 pr-2 text-sm font-semibold text-stone-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    className="w-full rounded-r-xl bg-transparent py-2.5 pr-3 text-sm font-medium text-stone-900 outline-none placeholder:text-stone-400"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? "Loading Card..." : "View My Stamp Card →"}
              </button>
            </form>

            <div className="mt-6 border-t border-stone-100 pt-4 text-center">
              <p className="text-[11px] text-stone-400">
                🔒 No app download required. Your stamps stay linked to your phone.
              </p>
            </div>
          </div>
        ) : loading && !data ? (
          <div className="mt-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
            <p className="text-xs font-medium text-stone-500">Loading your loyalty card...</p>
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
                  <p className="text-[11px] font-medium text-stone-500">
                    +91 {data.customer.phone}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSwitchAccount}
                className="text-[11px] font-semibold text-stone-400 hover:text-stone-700 transition underline"
              >
                Switch
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex rounded-xl bg-stone-200/70 p-1 text-xs font-semibold text-stone-600">
              <button
                onClick={() => setActiveTab("card")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  activeTab === "card" ? "bg-white text-stone-900 shadow-xs" : "hover:text-stone-900"
                }`}
              >
                ☕ Stamp Card
              </button>
              <button
                onClick={() => setActiveTab("rewards")}
                className={`relative flex-1 rounded-lg py-1.5 transition ${
                  activeTab === "rewards" ? "bg-white text-stone-900 shadow-xs" : "hover:text-stone-900"
                }`}
              >
                🎁 Rewards
                {activeRewards.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {activeRewards.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  activeTab === "history" ? "bg-white text-stone-900 shadow-xs" : "hover:text-stone-900"
                }`}
              >
                📜 History
              </button>
            </div>

            {/* TAB 1: THE STAMP CARD */}
            {activeTab === "card" && (
              <div className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-5 shadow-md">
                {/* Visual Card Accent Header */}
                <div
                  className="absolute -top-24 -right-24 h-48 w-48 rounded-full opacity-15 blur-2xl pointer-events-none"
                  style={{ backgroundColor: brandColor }}
                />

                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-600">
                      {data.customer.lifetimeStamps >= 20 ? "VIP Member 👑" : "Rewards Member ⭐"}
                    </span>
                    <h3 className="mt-1 font-display text-lg font-bold text-stone-900">
                      {data.program.title}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="font-display text-2xl font-extrabold text-stone-900">
                      {currentStamps}
                    </span>
                    <span className="text-xs font-semibold text-stone-400"> / {stampsRequired}</span>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      {progressPercent}% Done
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: brandColor,
                      }}
                    />
                  </div>
                </div>

                {/* STAMP GRID (e.g. 10 spots) */}
                <div className="mt-5 grid grid-cols-5 gap-2.5">
                  {Array.from({ length: stampsRequired }).map((_, idx) => {
                    const stampNum = idx + 1;
                    const isStamped = stampNum <= currentStamps;
                    const isGoal = stampNum === stampsRequired;

                    return (
                      <div
                        key={stampNum}
                        className={`group relative flex flex-col items-center justify-center rounded-2xl border aspect-square transition-all duration-300 ${
                          isStamped
                            ? "border-transparent text-white shadow-sm scale-100"
                            : isGoal
                            ? "border-amber-300 bg-amber-50/70 border-dashed animate-pulse text-amber-700"
                            : "border-dashed border-stone-200 bg-stone-50/50 text-stone-400"
                        }`}
                        style={{
                          backgroundColor: isStamped ? brandColor : undefined,
                        }}
                      >
                        {isStamped ? (
                          <div className="flex flex-col items-center">
                            <span className="text-lg leading-none">☕</span>
                            <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider opacity-90">
                              #{stampNum}
                            </span>
                          </div>
                        ) : isGoal ? (
                          <div className="flex flex-col items-center">
                            <span className="text-lg leading-none">🎁</span>
                            <span className="mt-0.5 text-[9px] font-extrabold text-amber-800">
                              Goal
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="h-2 w-2 rounded-full bg-stone-300 mb-1" />
                            <span className="text-[10px] font-semibold text-stone-400">
                              {stampNum}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Motivational Banner */}
                <div className="mt-5 rounded-2xl bg-stone-50 border border-stone-100 p-3.5 text-center">
                  {stampsRemaining === 0 ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs">
                      <span>🎉 Congratulations! Reward unlocked. Check the Rewards tab!</span>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-stone-700">
                      Collect <strong className="font-bold text-stone-900">{stampsRemaining} more stamp{stampsRemaining > 1 ? "s" : ""}</strong> to unlock <span className="font-bold text-emerald-700">{data.program.rewardTitle}</span>!
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-stone-400">
                    Earn 1 stamp for each purchase of ₹{(data.program.minBillAmount / 100).toFixed(0)} or more.
                  </p>
                </div>

                {/* Active Reward Alert if any */}
                {activeRewards.length > 0 && (
                  <button
                    onClick={() => setActiveTab("rewards")}
                    className="mt-3 flex w-full items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-left transition hover:bg-emerald-100/70"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🎁</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-900">
                          {activeRewards.length} Unlocked Reward{activeRewards.length > 1 ? "s" : ""} Ready!
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Tap to view voucher and show to cashier
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-800">View →</span>
                  </button>
                )}
              </div>
            )}

            {/* TAB 2: UNLOCKED REWARDS */}
            {activeTab === "rewards" && (
              <div className="space-y-3">
                {activeRewards.length === 0 ? (
                  <div className="rounded-3xl border border-stone-200/80 bg-white p-8 text-center shadow-xs">
                    <span className="text-4xl">🎁</span>
                    <h3 className="mt-3 font-display text-base font-bold text-stone-900">
                      No Unlocked Rewards Yet
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Collect {stampsRemaining} more stamps to earn {data.program.rewardTitle}.
                    </p>
                    <button
                      onClick={() => setActiveTab("card")}
                      className="mt-4 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: brandColor }}
                    >
                      View Stamp Card
                    </button>
                  </div>
                ) : (
                  activeRewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-800 shadow-inner">
                            🎉
                          </div>
                          <div>
                            <h4 className="font-display text-base font-bold text-stone-900 leading-tight">
                              {reward.rewardTitle}
                            </h4>
                            <p className="text-xs font-semibold text-emerald-700">
                              ₹{(reward.discountAmount / 100).toFixed(0)} Instant Discount
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          ACTIVE
                        </span>
                      </div>

                      <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          Redemption Voucher Code
                        </p>
                        <p className="mt-0.5 font-mono text-xl font-extrabold tracking-widest text-stone-900">
                          {reward.code}
                        </p>
                        <p className="mt-1 text-[11px] text-stone-500">
                          Expires: {new Date(reward.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>

                      <button
                        onClick={() => showRewardQr(reward.code)}
                        className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-xs transition hover:brightness-105"
                        style={{ backgroundColor: brandColor }}
                      >
                        Show Voucher QR to Cashier 📱
                      </button>
                    </div>
                  ))
                )}

                {/* Redeemed or Past Rewards history */}
                {data.customer.rewards.filter((r) => r.status === "REDEEMED").length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1 mb-2">
                      Previously Redeemed
                    </h4>
                    <div className="space-y-2 opacity-60">
                      {data.customer.rewards
                        .filter((r) => r.status === "REDEEMED")
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-stone-800 line-through">
                                {r.rewardTitle} ({r.code})
                              </p>
                              <p className="text-[10px] text-stone-400">
                                Redeemed on {r.redeemedAt ? new Date(r.redeemedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "earlier"}
                              </p>
                            </div>
                            <span className="font-semibold text-stone-500">USED</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TRANSACTION HISTORY */}
            {activeTab === "history" && (
              <div className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-xs">
                <h3 className="font-display text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                  Stamp Activity Log
                </h3>

                {data.customer.transactions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-stone-400">
                    No transactions recorded yet. Ask your server for a stamp!
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100 mt-2">
                    {data.customer.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                            ☕
                          </span>
                          <div>
                            <p className="text-xs font-bold text-stone-900">
                              +{tx.stampsCount} Stamp Awarded
                            </p>
                            <p className="text-[10px] text-stone-400">
                              {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          {tx.billAmount && (
                            <span className="text-xs font-semibold text-stone-600">
                              ₹{(tx.billAmount / 100).toFixed(0)} bill
                            </span>
                          )}
                          {tx.billReference && (
                            <p className="text-[10px] text-stone-400">Ref: {tx.billReference}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="pt-2 text-center">
              <Link
                href={`/r/${slug}`}
                className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition"
              >
                <span>⭐ Leave a Review & Rating for {data.restaurant.name} →</span>
              </Link>
            </div>
          </div>
        ) : null}
      </main>

      {/* MODAL: REWARD QR POPUP */}
      {selectedRewardCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h3 className="font-display text-lg font-bold text-stone-900">
              Redeem Reward
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Show this QR or code to the staff at checkout
            </p>

            <div className="my-5 flex flex-col items-center justify-center rounded-2xl bg-stone-50 p-4 border border-stone-200/80">
              {selectedRewardQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedRewardQr}
                  alt={selectedRewardCode}
                  className="h-44 w-44 rounded-xl"
                />
              ) : (
                <div className="h-44 w-44 flex items-center justify-center text-4xl">
                  🎁
                </div>
              )}
              <p className="mt-3 font-mono text-xl font-black tracking-widest text-stone-900">
                {selectedRewardCode}
              </p>
            </div>

            <button
              onClick={() => {
                setSelectedRewardCode(null);
                setSelectedRewardQr(null);
              }}
              className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-stone-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
