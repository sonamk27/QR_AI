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
    phone: string;
    name: string | null;
    currentStamps: number;
    lifetimeStamps: number;
    cycleNumber: number;
    rewards: LoyaltyReward[];
    transactions: LoyaltyTransaction[];
  };
};

export function LoyaltyCardView({ slug }: { slug: string }) {
  const [phone, setPhone] = useState("");
  const [inputPhone, setInputPhone] = useState("");
  const [data, setData] = useState<LoyaltyCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"card" | "rewards" | "history">("card");
  
  // Voucher Modal state
  const [selectedRewardQr, setSelectedRewardQr] = useState<string | null>(null);
  const [selectedRewardCode, setSelectedRewardCode] = useState<string | null>(null);
  const [selectedRewardTitle, setSelectedRewardTitle] = useState<string | null>(null);
  const [selectedRewardDiscount, setSelectedRewardDiscount] = useState<number>(0);

  // Dynamic Diner Bill Calculator
  const [dinerBillInput, setDinerBillInput] = useState<string>("");

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

  async function showRewardQr(code: string, title?: string, discountPaise?: number) {
    setSelectedRewardTitle(title || "Reward Voucher");
    setSelectedRewardDiscount(discountPaise ? discountPaise / 100 : 0);

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

  // Dynamic savings calculations for diner
  const numericBill = Number(dinerBillInput) || 0;
  const dinerMeetsMin = numericBill >= minBillRupees;
  const calculatedSavings = dinerMeetsMin
    ? isPercent
      ? Math.round((numericBill * (data?.program.rewardDiscount || 0)) / 100)
      : Math.min(numericBill, (data?.program.rewardDiscount || 0) / 100)
    : 0;
  const netPayable = Math.max(0, numericBill - calculatedSavings);

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
            <span className="text-xs font-medium text-stone-500">Digital Offers &amp; Rewards</span>
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
                🎁
              </div>
              <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-stone-900">
                Unlock Dining Offers
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Enter your mobile number to view your active offer discounts &amp; digital vouchers!
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
                {loading ? "Loading Offers..." : "View My Dining Offers →"}
              </button>
            </form>

            <div className="mt-6 border-t border-stone-100 pt-4 text-center">
              <p className="text-[11px] text-stone-400">
                🔒 Instant discounts • No app download required.
              </p>
            </div>
          </div>
        ) : loading && !data ? (
          <div className="mt-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
            <p className="text-xs font-medium text-stone-500">Loading your offers &amp; rewards...</p>
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

            {/* DYNAMIC ACTIVE OFFER HIGHLIGHT HERO BANNER */}
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
                  <p className="mt-1 text-xs text-stone-600">
                    Enjoy <strong>{discountDisplay} OFF</strong> on qualifying bills of <strong>₹{minBillRupees} or more</strong> at {data.restaurant.name}!
                  </p>
                </div>

                {/* DYNAMIC BILL CALCULATOR */}
                <div className="mt-4 rounded-2xl bg-white/90 p-3.5 border border-amber-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      🧮 Calculate Your Bill Savings:
                    </span>
                    <span className="text-[10px] text-stone-400">Min. ₹{minBillRupees}</span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-stone-400">₹</span>
                    <input
                      type="number"
                      placeholder={`Enter bill amount (e.g. ₹${minBillRupees + 200})`}
                      value={dinerBillInput}
                      onChange={(e) => setDinerBillInput(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-7 pr-3 py-1.5 text-xs font-bold text-stone-900 outline-none focus:border-stone-800"
                    />
                  </div>

                  {numericBill > 0 && (
                    <div className="mt-2.5 rounded-xl bg-stone-50 p-2.5 text-xs space-y-1 border border-stone-200/60">
                      {dinerMeetsMin ? (
                        <>
                          <div className="flex justify-between font-bold text-emerald-800">
                            <span>🎉 Discount Applied:</span>
                            <span>-₹{calculatedSavings}</span>
                          </div>
                          <div className="flex justify-between font-extrabold text-stone-900 text-sm pt-1 border-t border-stone-200">
                            <span>You Pay at Counter:</span>
                            <span className="text-emerald-700">₹{netPayable}</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-amber-800 font-semibold text-[11px]">
                          💡 Add ₹{minBillRupees - numericBill} more to reach ₹{minBillRupees} and save {discountDisplay}!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                🎁 Vouchers
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
                {/* STAMP CYCLE BADGE */}
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-600">
                      {data.customer.lifetimeStamps >= 5 ? "VIP Regular 👑" : "Rewards Member ⭐"}
                    </span>
                    <h3 className="mt-1 font-display text-lg font-bold text-stone-900">
                      {data.program.title}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white mb-1"
                      style={{ backgroundColor: brandColor }}
                    >
                      Card #{data.customer.cycleNumber}
                    </span>
                    <div>
                      <span className="font-display text-2xl font-extrabold text-stone-900">
                        {currentStamps}
                      </span>
                      <span className="text-xs font-semibold text-stone-400"> / {stampsRequired}</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      {progressPercent}% Complete
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

                {/* STAMP SPOTS */}
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
                            ? "border-amber-300 bg-amber-50/70 border-dashed text-amber-700"
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
                              Offer
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

                {/* Fresh Cycle Banner — shown when stamps just reset after redemption */}
                {currentStamps === 0 && data.customer.cycleNumber > 1 && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center">
                    <p className="text-2xl">🎉</p>
                    <p className="mt-1 text-sm font-bold text-emerald-900">
                      Offer Redeemed — Fresh Card #{data.customer.cycleNumber} Started!
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      Visit & dine to earn your next {stampsRequired} stamps and unlock a new offer voucher.
                    </p>
                  </div>
                )}

                {/* Active Reward Alert */}
                {activeRewards.length > 0 && (
                  <button
                    onClick={() => setActiveTab("rewards")}
                    className="mt-5 flex w-full items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-left transition hover:bg-emerald-100/70"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🎁</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-900">
                          {activeRewards.length} Active Offer Voucher Ready to Use!
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Tap to view voucher and avail discount at billing
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-800">Avail →</span>
                  </button>
                )}
              </div>
            )}

            {/* TAB 2: UNLOCKED REWARDS / VOUCHERS */}
            {activeTab === "rewards" && (
              <div className="space-y-3">
                {activeRewards.length === 0 ? (
                  <div className="rounded-3xl border border-stone-200/80 bg-white p-8 text-center shadow-xs">
                    <span className="text-4xl">🎁</span>
                    <h3 className="mt-3 font-display text-base font-bold text-stone-900">
                      No Active Vouchers
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      All your previous vouchers have been availed.
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
                      className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:shadow-md space-y-3"
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
                              ₹{(reward.discountAmount / 100).toFixed(0)} Off on Qualifying Bill
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          READY TO AVAIL
                        </span>
                      </div>

                      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          Voucher Code for Cashier
                        </p>
                        <p className="mt-0.5 font-mono text-xl font-extrabold tracking-widest text-stone-900">
                          {reward.code}
                        </p>
                        <p className="mt-1 text-[11px] text-stone-500">
                          Expires: {new Date(reward.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>

                      {/* Show QR button only — redemption is done by cashier/owner from dashboard */}
                      <button
                        onClick={() => showRewardQr(reward.code, reward.rewardTitle, reward.discountAmount)}
                        className="w-full rounded-xl border border-stone-300 bg-white py-2.5 text-xs font-bold text-stone-800 shadow-xs hover:bg-stone-50 transition"
                      >
                        Show Voucher QR to Cashier 📱
                      </button>

                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 font-medium text-center">
                        💡 Show this code or QR to the cashier when billing. The cashier will apply your discount.
                      </div>
                    </div>
                  ))
                )}

                {/* Previously Redeemed */}
                {data.customer.rewards.filter((r) => r.status === "REDEEMED").length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1 mb-2">
                      Previously Availed Offers
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
                                Availed on {r.redeemedAt ? new Date(r.redeemedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "earlier"}
                              </p>
                            </div>
                            <span className="font-semibold text-emerald-700">AVAILED</span>
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
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <h3 className="font-display text-sm font-bold text-stone-900">
                    Visit &amp; Reward Activity Log
                  </h3>
                  <span className="text-[10px] font-bold text-stone-400">
                    +91 {data.customer.phone}
                  </span>
                </div>

                {data.customer.transactions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-stone-400">
                    No transactions recorded yet. Earn stamps by visiting and spending ₹{Math.round(data.program.minBillAmount / 100)} or more!
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100 mt-2">
                    {data.customer.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-start justify-between py-2.5 gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                            {tx.stampsCount > 0 ? "☕" : "🎁"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-stone-900">
                              {tx.stampsCount > 0
                                ? `+${tx.stampsCount} Stamp Earned`
                                : "Offer Voucher Redeemed"}
                            </p>
                            {tx.billReference && (
                              <p className="text-[10px] text-stone-500 font-mono truncate">
                                Ref: {tx.billReference}
                              </p>
                            )}
                            <p className="text-[10px] text-stone-400">
                              {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {tx.billAmount && (
                            <span className="text-xs font-semibold text-stone-700">
                              ₹{(tx.billAmount / 100).toFixed(0)}
                            </span>
                          )}
                          {tx.stampsCount === 0 && (
                            <p className="text-[10px] font-bold text-emerald-700">REDEEMED</p>
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
                <span>⭐ Leave a Review &amp; Rating for {data.restaurant.name} →</span>
              </Link>
            </div>
          </div>
        ) : null}
      </main>

      {/* MODAL: REWARD QR POPUP */}
      {selectedRewardCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl space-y-3">
            <h3 className="font-display text-lg font-bold text-stone-900">
              {selectedRewardTitle || "Dining Offer Voucher"}
            </h3>
            <p className="text-xs text-stone-500">
              Show this voucher QR or code to the cashier at billing counter
            </p>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-stone-50 p-4 border border-stone-200/80">
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

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 font-medium">
              💡 The cashier will scan or type this code to apply your discount at the counter.
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setSelectedRewardCode(null);
                  setSelectedRewardQr(null);
                }}
                className="w-full rounded-xl bg-stone-100 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
