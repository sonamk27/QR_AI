"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Stars } from "@/components/Stars";

export type CustomerJourneyProps = {
  slug: string;
  restaurant: {
    id: string;
    name: string;
    city?: string | null;
    logoUrl?: string | null;
    brandColor?: string;
    googleReviewUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    shareCaption?: string | null;
  };
  initialProgram: {
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
  initialPhone?: string | null;
  initialName?: string | null;
  initialView?: "welcome" | "card" | "review";
};

type RewardItem = {
  id: string;
  code: string;
  rewardTitle: string;
  discountAmount: number;
  status: "UNREDEEMED" | "REDEEMED" | "EXPIRED";
  expiresAt: string;
  redeemedAt: string | null;
};

type TransactionItem = {
  id: string;
  stampsCount: number;
  billAmount: number | null;
  billReference: string | null;
  createdAt: string;
  staffNote?: string | null;
};

type CustomerData = {
  id: string;
  name: string | null;
  phone: string;
  currentStamps: number;
  lifetimeStamps: number;
  cycleNumber: number;
  lastVisitAt: string | null;
  rewards: RewardItem[];
  transactions: TransactionItem[];
};

export function CustomerJourneyView({
  slug,
  restaurant,
  initialProgram,
  initialPhone,
  initialName,
  initialView = "welcome",
}: CustomerJourneyProps) {
  // Navigation View State
  const [currentView, setCurrentView] = useState<
    "welcome" | "register" | "card" | "stamp_added" | "review" | "reward_details" | "reward_redeemed"
  >(initialView);

  // Customer & Card Data
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [program, setProgram] = useState(initialProgram);
  const [loadingCard, setLoadingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Registration Form State (Step 3: Enter Details - No OTP)
  const [fullName, setFullName] = useState(initialName || "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || "");
  const [agreedUpdates, setAgreedUpdates] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Review & AI Assist State (Step 7: Share Your Experience)
  const [starRating, setStarRating] = useState<number>(5);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [customComment, setCustomComment] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Reward Voucher QR Modal / Screen State
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [rewardQrDataUrl, setRewardQrDataUrl] = useState<string | null>(null);

  // Quick Chips for review
  const reviewChips = [
    "Great coffee",
    "Cozy ambience",
    "Friendly staff",
    "Delicious food",
    "Quick service",
    "Loved the desserts",
  ];

  // Primary Theme Color (Warm Bronze/Coffee or Restaurant Brand)
  const brandColor = restaurant.brandColor || "#8C5A2B";

  // Check on mount for remembered phone
  useEffect(() => {
    const savedPhone =
      initialPhone ||
      localStorage.getItem(`loyalty_phone_${slug}`) ||
      localStorage.getItem("loyalty_phone");

    const savedName =
      initialName ||
      localStorage.getItem(`loyalty_name_${slug}`);

    if (savedName) setFullName(savedName);

    if (savedPhone) {
      setPhoneNumber(savedPhone);
      fetchLoyaltyCard(savedPhone);
    }
  }, [slug, initialPhone, initialName]);

  useEffect(() => {
    if (initialView) {
      setCurrentView(initialView);
    }
  }, [initialView]);

  async function fetchLoyaltyCard(phoneToFetch: string) {
    setLoadingCard(true);
    setCardError(null);
    try {
      const res = await fetch(
        `/api/loyalty/card?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(phoneToFetch)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load loyalty card");

      if (data.customer) {
        setCustomer(data.customer);
        if (data.program) setProgram(data.program);
        localStorage.setItem(`loyalty_phone_${slug}`, phoneToFetch);
        if (data.customer.name) {
          setFullName(data.customer.name);
          localStorage.setItem(`loyalty_name_${slug}`, data.customer.name);
        }
      }
    } catch (err: any) {
      setCardError(err.message || "Failed to load loyalty card");
    } finally {
      setLoadingCard(false);
    }
  }

  // Step 3 Handler: Register with Name & Phone (NO OTP)
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const finalPhone = cleanPhone.length > 10 && cleanPhone.startsWith("91") ? cleanPhone.slice(2) : cleanPhone;

    if (finalPhone.length < 10) {
      setRegisterError("Please enter a valid 10-digit mobile number");
      return;
    }

    if (!fullName.trim()) {
      setRegisterError("Please enter your name");
      return;
    }

    setRegistering(true);
    setRegisterError("");
    try {
      const res = await fetch("/api/loyalty/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: fullName.trim(),
          phone: finalPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register");

      setCustomer(data.customer);
      if (data.program) setProgram(data.program);

      localStorage.setItem(`loyalty_phone_${slug}`, finalPhone);
      localStorage.setItem(`loyalty_name_${slug}`, fullName.trim());

      // Move directly to Step 5: My Loyalty Card (Skipping OTP)
      setCurrentView("card");
    } catch (err: any) {
      setRegisterError(err.message || "Registration failed. Please try again.");
    } finally {
      setRegistering(false);
    }
  }

  // Step 7 Handler: AI Review Generator
  async function handleGenerateAiReview() {
    setGeneratingAi(true);
    try {
      const combinedText = [
        selectedChips.join(", "),
        customComment.trim(),
      ]
        .filter(Boolean)
        .join(". ");

      const res = await fetch("/api/public/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          overall: starRating,
          food: starRating,
          service: starRating,
          chips: selectedChips,
          text: combinedText || "Wonderful dining experience!",
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setAiDraft(data.text);
        setAiGenerated(true);
      } else {
        // Fallback default review
        setAiDraft(
          `Had a wonderful experience at ${restaurant.name}! ${
            selectedChips.length > 0 ? selectedChips.join(", ") + ". " : ""
          }The hospitality was outstanding and food was delicious. Highly recommended!`
        );
        setAiGenerated(true);
      }
    } catch {
      setAiDraft(
        `Had a wonderful experience at ${restaurant.name}! The ambiance is cozy, food is delicious, and staff is super friendly. Definitely visiting again!`
      );
      setAiGenerated(true);
    } finally {
      setGeneratingAi(false);
    }
  }

  // Copy & Post to Google Review
  async function handleCopyAndGoogleReview() {
    try {
      await navigator.clipboard.writeText(aiDraft);
      setCopiedReview(true);
    } catch {}

    // Track beacon
    navigator.sendBeacon?.(
      "/api/public/google-click",
      new Blob([JSON.stringify({ editedText: aiDraft })], { type: "application/json" })
    );

    if (restaurant.googleReviewUrl) {
      const opened = window.open(restaurant.googleReviewUrl, "_blank", "noopener,noreferrer");
      if (!opened || opened.closed || typeof opened.closed === "undefined") {
        // Fallback for mobile browsers blocking async window.open
        window.location.href = restaurant.googleReviewUrl;
      }
    }

    setReviewSubmitted(true);
  }

  // Show Reward Voucher QR Code
  async function handleOpenRewardQr(reward: RewardItem) {
    setSelectedReward(reward);
    try {
      const qr = await QRCode.toDataURL(reward.code, {
        width: 260,
        margin: 2,
        color: { dark: "#2C1810", light: "#FFFFFF" },
      });
      setRewardQrDataUrl(qr);
      setCurrentView("reward_details");
    } catch {
      setRewardQrDataUrl(null);
      setCurrentView("reward_details");
    }
  }

  const stampsRequired = program?.stampsRequired || 5;
  const currentStamps = customer?.currentStamps || 0;
  const stampsRemaining = Math.max(0, stampsRequired - currentStamps);
  const activeRewards = customer?.rewards?.filter((r) => r.status === "UNREDEEMED") || [];

  const isPercent = program?.discountType === "PERCENT";
  const discountDisplay = isPercent
    ? `${program.rewardDiscount}% OFF`
    : program.discountType === "FREE_ITEM"
    ? "Free Item"
    : `₹${(program.rewardDiscount / 100).toFixed(0)} OFF`;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-stone-900 antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* ─────────────────────────────────────────────────────────────
          STEP 2: WELCOME PAGE (Branded Landing Page with Two Options)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "welcome" && (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-8">
          {/* Top Brand Header */}
          <div className="text-center pt-2">
            <div className="inline-flex items-center justify-center gap-2">
              {restaurant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="h-12 w-12 rounded-full border border-stone-200 object-cover shadow-xs"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-xs"
                  style={{ backgroundColor: brandColor }}
                >
                  ☕
                </div>
              )}
            </div>
            <h2 className="mt-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
              {restaurant.name}
            </h2>
            {restaurant.city && (
              <p className="text-[11px] text-stone-400">Cafe &amp; Bistro • {restaurant.city}</p>
            )}
          </div>

          {/* Hero Welcome Card */}
          <div className="my-auto py-6 text-center">
            {/* Visual Cafe / Dish Hero Illustration */}
            <div className="relative mx-auto mb-6 flex h-48 w-full max-w-[320px] items-center justify-center overflow-hidden rounded-3xl border border-stone-200/80 bg-gradient-to-b from-amber-50 to-[#F5EFEB] shadow-sm">
              <div className="flex flex-col items-center">
                <span className="text-6xl animate-bounce">☕🥐</span>
                <div className="mt-2 flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 shadow-2xs text-xs font-semibold text-amber-900">
                  <span>✨</span>
                  <span>{program.rewardTitle || "Rewards & Diners Club"}</span>
                </div>
              </div>
            </div>

            <h1 className="font-serif text-3xl font-extrabold tracking-tight text-stone-900 leading-tight">
              Good Food<br />Brings People Together
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-sm text-stone-600 leading-relaxed">
              Join our loyalty program and share your experience with the world.
            </p>

            {/* Two Clear Options: Collect My Stamp & Share Your Experience */}
            <div className="mt-8 space-y-3">
              <button
                onClick={() => {
                  if (customer) {
                    setCurrentView("card");
                  } else {
                    setCurrentView("register");
                  }
                }}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.98]"
                style={{ backgroundColor: brandColor }}
              >
                Collect My Stamp
              </button>

              <button
                onClick={() => setCurrentView("review")}
                className="w-full rounded-2xl border-2 border-stone-300 bg-white py-3.5 text-sm font-bold text-stone-800 shadow-2xs hover:bg-stone-50 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>⭐</span>
                <span>Give Google Feedback &amp; Review</span>
              </button>
            </div>
          </div>

          {/* Three Value Badges at Bottom */}
          <div className="flex items-center justify-center gap-6 border-t border-stone-200/60 pt-6 text-center text-xs font-medium text-stone-500">
            <div className="flex items-center gap-1.5">
              <span>☕</span>
              <span>Great Food</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>🧡</span>
              <span>Kind People</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>🤝</span>
              <span>Better Together</span>
            </div>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 3: ENTER DETAILS (Name & Mobile Number — NO OTP)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "register" && (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-6">
          {/* Header Bar */}
          <div>
            <button
              onClick={() => setCurrentView("welcome")}
              className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
            >
              <span>←</span> Back
            </button>

            <div className="mt-6 text-center">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-sm"
                style={{ backgroundColor: brandColor }}
              >
                ✨
              </div>
              <h1 className="mt-4 font-serif text-2xl font-bold text-stone-900">
                Join Our Rewards
              </h1>
              <p className="mt-1 text-xs text-stone-500">
                A few details to get started
              </p>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleRegister} className="mt-8 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 outline-none focus:border-stone-800 shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-stone-200 bg-white shadow-2xs focus-within:border-stone-800 transition">
                  <span className="flex items-center pl-4 pr-2 text-sm font-semibold text-stone-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full rounded-r-xl bg-transparent py-3 pr-4 text-sm font-medium text-stone-900 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Opt-in updates checkbox */}
              <div className="flex items-start gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="optin"
                  checked={agreedUpdates}
                  onChange={(e) => setAgreedUpdates(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-0"
                />
                <label htmlFor="optin" className="text-[11px] leading-tight text-stone-500">
                  I agree to receive important updates about my rewards, offers and news. You can opt out anytime.
                </label>
              </div>

              {registerError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  {registerError}
                </div>
              )}

              <button
                type="submit"
                disabled={registering}
                className="mt-4 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: brandColor }}
              >
                {registering ? "Connecting Rewards..." : "Continue to Rewards →"}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-[11px] text-stone-400">
            🔒 Fast 1-click registration • No password or OTP required.
          </p>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 5: MY LOYALTY CARD (Visual Coffee Cup Stamp Dots)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "card" && (
        <main className="mx-auto min-h-screen max-w-md px-5 py-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-stone-200/70 pb-4">
            <button
              onClick={() => setCurrentView("welcome")}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition flex items-center gap-1"
            >
              <span>←</span> Home
            </button>
            <div className="text-center">
              <h2 className="font-serif text-base font-bold text-stone-900 leading-tight">
                My Rewards
              </h2>
              <p className="text-[11px] text-stone-500">{restaurant.name}</p>
            </div>
            <button
              onClick={() => setCurrentView("review")}
              className="rounded-lg bg-amber-100/70 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-200 transition"
            >
              ⭐ Review
            </button>
          </div>

          {loadingCard && !customer ? (
            <div className="py-20 text-center text-xs font-medium text-stone-400">
              Loading your reward stamps...
            </div>
          ) : cardError ? (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 text-center">
              <p className="text-xs text-rose-700">{cardError}</p>
              <button
                onClick={() => fetchLoyaltyCard(phoneNumber)}
                className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* STAMP CARD (Matching Phone 5 Mockup) */}
              <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Digital Loyalty Card
                    </h3>
                    <p className="text-sm font-extrabold text-stone-800">
                      {customer?.name || "Valued Customer"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black" style={{ color: brandColor }}>
                      {currentStamps}
                    </span>
                    <span className="text-xs font-bold text-stone-400">/{stampsRequired}</span>
                    <span className="block text-[10px] text-stone-400">Stamps</span>
                  </div>
                </div>

                {/* Stamp Icons Row (Coffee Cups / Checkmarks) */}
                <div className="my-6 grid grid-cols-5 gap-3">
                  {Array.from({ length: stampsRequired }).map((_, index) => {
                    const isStamped = index < currentStamps;
                    const isTarget = index === stampsRequired - 1;

                    return (
                      <div
                        key={index}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all ${
                          isStamped
                            ? "border-transparent text-white shadow-xs scale-105"
                            : "border-stone-200 bg-stone-50/60 text-stone-300"
                        }`}
                        style={{
                          backgroundColor: isStamped ? brandColor : undefined,
                        }}
                      >
                        {isStamped ? (
                          <span className="text-xl">☕</span>
                        ) : isTarget ? (
                          <span className="text-xl">🎁</span>
                        ) : (
                          <span className="text-sm font-semibold text-stone-400">☕</span>
                        )}
                        <span
                          className={`text-[9px] font-bold ${
                            isStamped ? "text-white/80" : "text-stone-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Subtitle */}
                <div className="rounded-2xl bg-amber-50/60 border border-amber-200/60 p-3 text-center">
                  <p className="text-xs font-semibold text-amber-900">
                    {currentStamps >= stampsRequired
                      ? "🎉 Goal Reached! Your reward voucher is ready to redeem!"
                      : stampsRemaining === 1
                      ? "One more visit to unlock your reward!"
                      : `${stampsRemaining} more visits to unlock your reward!`}
                  </p>
                </div>
              </div>

              {/* NEXT REWARD CARD (Matching Golden Gift Box Banner) */}
              <div className="rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-50/40 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-block rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Next Reward
                  </span>
                  <span className="text-xs font-bold text-amber-800">
                    Valid for {program.rewardExpiryDays || 30} days
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-serif text-xl font-extrabold text-stone-900">
                      {discountDisplay}
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {program.rewardTitle || "on your next visit"}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-200/70 text-2xl shadow-inner">
                    🎁
                  </div>
                </div>
              </div>

              {/* Active Unredeemed Rewards / Vouchers */}
              {activeRewards.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Available Vouchers ({activeRewards.length})
                  </h4>
                  {activeRewards.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-2xl border-2 border-dashed border-amber-300 bg-white p-4 shadow-xs"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-amber-800 uppercase">
                          Unlocked Voucher
                        </span>
                        <h5 className="text-sm font-bold text-stone-900">{r.rewardTitle}</h5>
                        <p className="font-mono text-xs font-semibold text-stone-500">
                          {r.code}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenRewardQr(r)}
                        className="rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:brightness-105 transition"
                        style={{ backgroundColor: brandColor }}
                      >
                        Redeem →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Links: View Reward Details & Visit History */}
              <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200/80 bg-white">
                <button
                  onClick={() => {
                    if (activeRewards[0]) {
                      handleOpenRewardQr(activeRewards[0]);
                    } else {
                      alert(`Collect ${stampsRemaining} more stamps to unlock your reward voucher!`);
                    }
                  }}
                  className="flex w-full items-center justify-between p-4 text-xs font-bold text-stone-700 hover:bg-stone-50 transition"
                >
                  <span className="flex items-center gap-2">
                    <span>🎟️</span>
                    <span>View Reward Details</span>
                  </span>
                  <span>›</span>
                </button>

                <div className="p-4">
                  <h5 className="text-xs font-bold text-stone-700 flex items-center gap-2 mb-2">
                    <span>📜</span>
                    <span>Visit &amp; Stamp History ({customer?.transactions?.length || 0})</span>
                  </h5>
                  {customer?.transactions && customer.transactions.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {customer.transactions.map((tx) => (
                        <div key={tx.id} className="flex justify-between text-[11px] text-stone-600 border-b border-stone-50 pb-1">
                          <span>
                            {tx.stampsCount > 0 ? `+${tx.stampsCount} Stamp(s) Awarded` : "Offer Redeemed"}
                            {tx.billReference ? ` (${tx.billReference})` : ""}
                          </span>
                          <span className="text-stone-400">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400">No previous visits recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Action: Share Your Experience */}
              <button
                onClick={() => setCurrentView("review")}
                className="w-full rounded-2xl border border-stone-300 bg-white py-3 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 transition flex items-center justify-center gap-2"
              >
                <span>⭐</span>
                <span>Share Your Experience &amp; Review</span>
              </button>

              {/* Counter instructions */}
              <div className="rounded-2xl bg-stone-100/70 p-3.5 text-center text-[11px] text-stone-500">
                Staff member will ask for your mobile number (<strong>{customer?.phone}</strong>) or QR code to stamp your card.
              </div>
            </div>
          )}
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 6: STAFF ISSUES STAMP (Celebration Screen)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "stamp_added" && (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-8 text-center">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-amber-100 text-5xl shadow-md border-4 border-white animate-pulse">
            ☕
          </div>

          <h1 className="font-serif text-3xl font-extrabold text-stone-900">
            Stamp Added!
          </h1>
          <p className="mt-2 max-w-xs text-sm text-stone-600 leading-relaxed">
            Your visit has been recorded. You&apos;re one step closer to your reward!
          </p>

          <button
            onClick={() => setCurrentView("card")}
            className="mt-8 w-full max-w-xs rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.98]"
            style={{ backgroundColor: brandColor }}
          >
            View My Rewards
          </button>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 7: SHARE YOUR EXPERIENCE (Optional AI-Assisted Review)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "review" && (
        <main className="mx-auto min-h-screen max-w-md px-5 py-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-stone-200/70 pb-4">
            <button
              onClick={() => setCurrentView("welcome")}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition flex items-center gap-1"
            >
              <span>←</span> Back
            </button>
            <div className="text-center">
              <h2 className="font-serif text-base font-bold text-stone-900 leading-tight">
                Share Your Experience
              </h2>
              <p className="text-[11px] text-stone-500">{restaurant.name}</p>
            </div>
            <div className="w-10" />
          </div>

          <div className="mt-6 text-center">
            <h3 className="font-serif text-2xl font-bold text-stone-900">
              Share Your Experience
            </h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-stone-500">
              Help others discover great food. We&apos;ll help you write an honest review.
            </p>

            {/* 5-Star Rating Component */}
            <div className="my-5 flex justify-center">
              <Stars value={starRating} onChange={setStarRating} />
            </div>
          </div>

          {/* What Did You Like (Chips & Text) */}
          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-xs">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                What did you like? (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {reviewChips.map((chip) => {
                  const isSelected = selectedChips.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setSelectedChips((prev) =>
                          isSelected ? prev.filter((c) => c !== chip) : [...prev, chip]
                        );
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? "bg-stone-900 text-white font-bold"
                          : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <textarea
                placeholder="Any special dish or experience you enjoyed? e.g. Loved the pasta, cozy seating and friendly staff!"
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-900 outline-none focus:border-stone-800 focus:bg-white transition"
              />
            </div>

            {/* Button: Generate Review with AI */}
            <button
              onClick={handleGenerateAiReview}
              disabled={generatingAi}
              className="w-full rounded-2xl py-3 text-xs font-bold text-white shadow-xs transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              <span>✨</span>
              <span>{generatingAi ? "Crafting Review with AI..." : "Generate Review with AI"}</span>
            </button>

            {restaurant.googleReviewUrl && (
              <div className="pt-1 text-center">
                <a
                  href={restaurant.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 underline"
                >
                  Or open Google Reviews directly without AI draft ↗
                </a>
              </div>
            )}
          </div>

          {/* AI Suggested Review Box */}
          {aiGenerated && (
            <div className="mt-5 rounded-3xl border border-amber-300 bg-amber-50/40 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  AI Suggested Review
                </span>
                <button
                  onClick={() => setIsEditingDraft(!isEditingDraft)}
                  className="text-xs font-bold text-stone-600 hover:text-stone-900 underline"
                >
                  {isEditingDraft ? "Done Editing" : "Edit"}
                </button>
              </div>

              {isEditingDraft ? (
                <textarea
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-amber-300 bg-white p-3 text-xs text-stone-900 outline-none"
                />
              ) : (
                <p className="text-xs font-medium text-stone-800 leading-relaxed italic bg-white/70 p-3 rounded-xl border border-amber-200/60">
                  &ldquo;{aiDraft}&rdquo;
                </p>
              )}

              {/* Action Buttons: Edit & Copy & Review on Google */}
              <div className="pt-2">
                <button
                  onClick={handleCopyAndGoogleReview}
                  className="w-full rounded-2xl bg-[#1A73E8] py-3.5 text-xs font-bold text-white shadow-sm hover:bg-[#1557B0] transition active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span className="font-black text-sm">G</span>
                  <span>{copiedReview ? "Review Copied! Opening Google..." : "Copy & Review on Google"}</span>
                </button>
              </div>

              {reviewSubmitted && (
                <div className="rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200 text-center space-y-1.5">
                  <p className="text-xs font-bold text-emerald-800">
                    ✅ Review copied to clipboard!
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Paste your copied review text into the Google review box that opened.
                  </p>
                  {restaurant.googleReviewUrl && (
                    <a
                      href={restaurant.googleReviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 text-xs font-bold text-[#1A73E8] underline hover:text-[#1557B0]"
                    >
                      Click here if Google Reviews didn&apos;t open automatically ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bottom Stamp CTA */}
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-stone-700">
              Want to collect a loyalty stamp for your visit?
            </p>
            <button
              onClick={() => {
                if (customer) setCurrentView("card");
                else setCurrentView("register");
              }}
              className="mt-2 text-xs font-bold underline text-stone-900"
            >
              Collect My Stamp Now →
            </button>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: REWARD REDEMPTION SCREENS
      ───────────────────────────────────────────────────────────── */}
      {/* SCREEN 2: YOUR REWARD (Voucher QR Modal) */}
      {currentView === "reward_details" && selectedReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                🎁 Redeem at Counter
              </span>
              <button
                onClick={() => setCurrentView("card")}
                className="text-stone-400 hover:text-stone-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <h4 className="mt-3 font-serif text-xl font-bold text-stone-900">
              Your Reward
            </h4>
            <p className="text-xs font-bold text-amber-800">
              {selectedReward.rewardTitle}
            </p>

            {/* Generated QR Code */}
            <div className="my-4 flex justify-center">
              {rewardQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rewardQrDataUrl}
                  alt={`Voucher ${selectedReward.code}`}
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
                {selectedReward.code}
              </span>
            </div>

            <p className="mt-2 text-[11px] text-stone-400">
              Valid until {new Date(selectedReward.expiresAt).toLocaleDateString()}
            </p>

            <p className="mt-3 text-[11px] text-stone-500 leading-tight">
              Show this code to staff to redeem your reward.
            </p>

            <button
              onClick={() => setCurrentView("card")}
              className="mt-4 w-full rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800"
            >
              Back to My Rewards
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 3: REWARD REDEEMED CELEBRATION */}
      {currentView === "reward_redeemed" && (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-8 text-center">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-100 text-5xl shadow-md border-4 border-white">
            ✅
          </div>

          <h1 className="font-serif text-3xl font-extrabold text-stone-900">
            Reward Redeemed!
          </h1>
          <p className="mt-2 max-w-xs text-sm text-stone-600 leading-relaxed">
            Enjoy your discount on your bill today.
          </p>

          <button
            onClick={() => setCurrentView("card")}
            className="mt-8 w-full max-w-xs rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.98]"
            style={{ backgroundColor: brandColor }}
          >
            Back to My Rewards
          </button>
        </main>
      )}
    </div>
  );
}
