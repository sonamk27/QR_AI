"use client";

import { useEffect, useRef, useState } from "react";
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
    requireOwnerVerification?: boolean;
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
  stampCycleStartedAt: string | null;
  cycleEndsAt: string | null;
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
    "welcome" | "register" | "request_pending" | "card" | "stamp_added" | "review" | "reward_details" | "reward_redeemed"
  >(initialView);

  // Customer & Card Data
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [program, setProgram] = useState(initialProgram);
  const [loadingCard, setLoadingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [collectingStamp, setCollectingStamp] = useState(false);
  const [stampFeedbackMessage, setStampFeedbackMessage] = useState<string | null>(null);

  // Stamp Request to Owner State
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingTableNo, setPendingTableNo] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Registration Form State (Step 3: Enter Details)
  const [fullName, setFullName] = useState(initialName || "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || "");
  const [agreedUpdates, setAgreedUpdates] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const registerLockRef = useRef(false);
  const collectLockRef = useRef(false);

  // Review & AI Assist State (Step 7: Share Your Experience)
  const [starRating, setStarRating] = useState<number>(0);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [customComment, setCustomComment] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [reviewGenerationError, setReviewGenerationError] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [googlePopupBlocked, setGooglePopupBlocked] = useState(false);
  const [reviewVariantIndex, setReviewVariantIndex] = useState(0);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);

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

  // Theme Accent: Muted Gold #B58A4B
  const accentGold = "#B58A4B";

  const brandColor = restaurant.brandColor || "#B58A4B";

  // Check on mount for remembered phone — pre-fill but always show the register prompt
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const savedPhone =
        initialPhone ||
        localStorage.getItem(`loyalty_phone_${slug}`) ||
        localStorage.getItem("loyalty_phone");

      const savedName =
        initialName ||
        localStorage.getItem(`loyalty_name_${slug}`);

      if (savedName) setFullName(savedName);
      if (savedPhone) setPhoneNumber(savedPhone);

      // Always start at register (phone prompt) — user must confirm their number each scan
      setCurrentView("register");
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [slug, initialPhone, initialName]);

  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) {
      setCurrentView(initialView);
    }
    isMounted.current = true;
  }, [initialView]);

  // Live polling: automatically refresh card in background
  useEffect(() => {
    if (currentView !== "card") return;
    const phoneToPoll = customer?.phone || phoneNumber;
    if (!phoneToPoll) return;

    const interval = setInterval(() => {
      fetchLoyaltyCard(phoneToPoll, true);
    }, 4000);

    return () => clearInterval(interval);
  }, [currentView, customer?.phone, phoneNumber]);

  // Auto-load card data when entering card view without customer data (safety net)
  const cardLoadRef = useRef(false);
  useEffect(() => {
    if (currentView !== "card") {
      cardLoadRef.current = false;
      return;
    }
    if (customer || cardLoadRef.current) return;
    const phoneToUse = phoneNumber;
    if (!phoneToUse) return;
    cardLoadRef.current = true;
    fetchLoyaltyCard(phoneToUse);
  }, [currentView, phoneNumber]);

  async function fetchLoyaltyCard(phoneToFetch: string, silent = false) {
    if (!silent) {
      setLoadingCard(true);
      setCardError(null);
    }
    try {
      const res = await fetch(
        `/api/loyalty/card?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(phoneToFetch)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load loyalty card");

      if (data.customer) {
        setCustomer({
          ...data.customer,
          cycleNumber: data.customer.cycleNumber ?? 1,
          stampCycleStartedAt: data.customer.stampCycleStartedAt ?? null,
          cycleEndsAt: data.customer.cycleEndsAt ?? null,
          lastVisitAt: data.customer.lastVisitAt ?? null,
        });
        if (data.program) setProgram(data.program);
        localStorage.setItem(`loyalty_phone_${slug}`, phoneToFetch);
        if (data.customer.name) {
          setFullName(data.customer.name);
          localStorage.setItem(`loyalty_name_${slug}`, data.customer.name);
        }
        // If we loaded the card, navigate to card view (only on first non-silent load)
        if (!silent) {
          setCurrentView("card");
        }
      }
    } catch (err: any) {
      if (!silent) {
        setCardError(err.message || "Failed to load loyalty card");
      }
    } finally {
      if (!silent) {
        setLoadingCard(false);
      }
    }
  }

  // Poll status when a stamp request is pending with owner
  useEffect(() => {
    if (!pendingRequestId && currentView !== "request_pending") return;

    let isCancelled = false;

    async function checkStatus() {
      const phoneToUse = customer?.phone || phoneNumber;
      const url = pendingRequestId
        ? `/api/loyalty/request-stamp/status?requestId=${encodeURIComponent(pendingRequestId)}`
        : `/api/loyalty/request-stamp/status?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(phoneToUse)}`;

      try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (isCancelled) return;

        if (data.status === "APPROVED") {
          setPendingRequestId(null);
          if (data.customer) {
            setCustomer({
              ...data.customer,
              cycleNumber: data.customer.cycleNumber ?? 1,
              lastVisitAt: data.customer.lastVisitAt ?? null,
            });
          }
          if (data.program) setProgram(data.program);
          setStampFeedbackMessage(data.message || "Your visit has been recorded. You're one step closer to your reward!");
          setCurrentView("stamp_added");
        } else if (data.status === "REJECTED") {
          setPendingRequestId(null);
          setRequestError(data.message || "Your stamp request was declined by the restaurant staff.");
        } else if (data.status === "PENDING") {
          if (!pendingRequestId && data.requestId) {
            setPendingRequestId(data.requestId);
          }
          if (data.tableNo && !pendingTableNo) {
            setPendingTableNo(data.tableNo);
          }
        }
      } catch (err) {
        console.error("Status check failed:", err);
      }
    }

    checkStatus();
      const interval = setInterval(checkStatus, 1500);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [pendingRequestId, currentView, customer?.phone, phoneNumber, slug, pendingTableNo]);

  // Collect Stamp Handler (Customer sends request to owner)
  async function handleCollectStampClick() {
    if (collectLockRef.current) return;
    const phoneToUse = customer?.phone || phoneNumber;
    if (!phoneToUse) {
      setCurrentView("register");
      return;
    }

    if (hasCollectedStampToday) {
      setStampFeedbackMessage("You already received a stamp for today's visit!");
      setCurrentView("card");
      return;
    }

    collectLockRef.current = true;
    setCollectingStamp(true);
    setCardError(null);
    setRequestError(null);
    try {
      const res = await fetch("/api/loyalty/request-stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          phone: phoneToUse,
          name: fullName || customer?.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit stamp request");

      if (data.alreadyCollected) {
        setStampFeedbackMessage(data.message || "You already received a stamp for today's visit!");
        await fetchLoyaltyCard(phoneToUse);
        setCurrentView("card");
        return;
      }

      setPendingRequestId(data.requestId);
      setPendingTableNo(data.tableNo || null);
      setCurrentView("request_pending");
    } catch (err: any) {
      setCardError(err.message || "Failed to submit stamp request");
    } finally {
      setCollectingStamp(false);
      collectLockRef.current = false;
    }
  }

  // Step 3 Handler: Register with Name & Phone
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (registerLockRef.current) return;
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

    registerLockRef.current = true;
    setRegistering(true);
    setRegisterError("");
    try {
      localStorage.setItem(`loyalty_phone_${slug}`, finalPhone);
      localStorage.setItem(`loyalty_name_${slug}`, fullName.trim());

      const res = await fetch("/api/loyalty/request-stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: fullName.trim(),
          phone: finalPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register request");

      if (data.alreadyCollected) {
        setStampFeedbackMessage(data.message || "You already received a stamp for today's visit!");
        await fetchLoyaltyCard(finalPhone);
        setCurrentView("card");
        return;
      }

      setPendingRequestId(data.requestId);
      setPendingTableNo(data.tableNo || null);
      setCurrentView("request_pending");
    } catch (err: any) {
      setRegisterError(err.message || "Registration failed. Please try again.");
    } finally {
      setRegistering(false);
      registerLockRef.current = false;
    }
  }

  // Step 7 Handler: AI Review Generator
  async function handleGenerateAiReview() {
    if (starRating < 1 || starRating > 5) return;
    setGeneratingAi(true);
    setReviewGenerationError("");
    try {
      const variants = ["short", "casual", "detailed"] as const;
      const variant = variants[reviewVariantIndex % variants.length];
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
          sessionId: reviewSessionId,
          overall: starRating,
          chips: selectedChips,
          text: combinedText || undefined,
          variant,
          previousDraft: aiGenerated ? aiDraft : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.text) {
        throw new Error(data.error || "Could not generate your review. Please try again.");
      }
      setAiDraft(data.text);
      setAiGenerated(true);
      setReviewSessionId(data.sessionId);
      setReviewVariantIndex((i) => i + 1);
    } catch (error) {
      setReviewGenerationError(
        error instanceof Error ? error.message : "Could not generate your review. Please try again.",
      );
    } finally {
      setGeneratingAi(false);
    }
  }

  // Copy & Post to Google Review
  async function handleCopyAndGoogleReview() {
    // ⚠️ Open Google window SYNCHRONOUSLY (before any await) so browsers allow it.
    // If opened after an async call, most browsers treat it as a popup and block it.
    let googleWin: Window | null = null;
    const googleUrl = restaurant.googleReviewUrl;
    if (googleUrl) {
      googleWin = window.open(googleUrl, "_blank", "noopener,noreferrer");
    }

    try {
      await navigator.clipboard.writeText(aiDraft);
      setCopiedReview(true);
    } catch {
      // Continue if clipboard write fails
    }

    navigator.sendBeacon?.(
      "/api/public/google-click",
      new Blob([JSON.stringify({ editedText: aiDraft })], { type: "application/json" })
    );

    // Fallback: if popup was blocked, navigate in same tab
    if (restaurant.googleReviewUrl && (!googleWin || googleWin.closed)) {
      window.location.href = restaurant.googleReviewUrl;
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
        color: { dark: "#24211E", light: "#FFFFFF" },
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

  // Check if customer already collected a stamp today (1 stamp per visit/day)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hasCollectedStampToday = Boolean(
    customer?.transactions?.some((tx) => {
      if (!tx.stampsCount || tx.stampsCount <= 0) return false;
      const txDate = new Date(tx.createdAt);
      return txDate >= twentyFourHoursAgo;
    })
  );

  const isPercent = program?.discountType === "PERCENT";
  const discountDisplay = isPercent
    ? `${program.rewardDiscount}% OFF`
    : program.discountType === "FREE_ITEM"
      ? "Free Item"
      : `₹${(program.rewardDiscount / 100).toFixed(0)} OFF`;

  return (
    <div className="min-h-screen bg-[#F7F2E9] font-sans text-[#24211E] antialiased selection:bg-[#FAF5ED] selection:text-[#24211E]">
      {/* ─────────────────────────────────────────────────────────────
          STEP 2: WELCOME PAGE (Branded Landing Page with Two Clear Options)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "welcome" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-between px-5 py-7">
          {/* Top Brand Header */}
          <div className="text-center pt-1">
            <div className="inline-flex items-center justify-center">
              {restaurant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="h-12 w-12 rounded-full border border-[#E8DFD1] object-cover shadow-2xs"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B58A4B] text-2xl text-white shadow-2xs">
                  ☕
                </div>
              )}
            </div>
            <h2 className="mt-2 font-serif text-lg font-bold text-[#24211E] tracking-tight">
              {restaurant.name}
            </h2>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#716B64]">
              Cafe &amp; Bistro {restaurant.city ? `• ${restaurant.city}` : ""}
            </p>
          </div>

          {/* Hero Welcome Card */}
          <div className="my-auto py-4 text-center">
            {/* Visual Cafe / Dish Hero Illustration */}
            <div className="relative mx-auto mb-6 flex h-48 w-full max-w-[300px] items-center justify-center overflow-hidden rounded-3xl border border-[#E8DFD1] bg-gradient-to-b from-[#FAF6F0] via-[#F4ECE1] to-[#EFE4D2] shadow-subtle">
              <div className="flex flex-col items-center">
                <span className="text-6xl drop-shadow-sm">☕🥐</span>
                <div className="mt-3 flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm px-3.5 py-1 shadow-sm text-xs font-semibold text-[#7A5826] border border-[#E8D8BA]">
                  <span>✨</span>
                  <span>{program.rewardTitle || "Rewards & Diners Club"}</span>
                </div>
              </div>
            </div>

            <h1 className="font-serif text-3xl font-extrabold tracking-tight text-[#24211E] leading-tight">
              Good Food<br />Brings People Together
            </h1>
            <p className="mx-auto mt-2.5 max-w-xs text-xs text-[#716B64] leading-relaxed">
              Join our loyalty program and share your experience with the world.
            </p>

            {/* Two Clear Options: Collect My Stamp & Share Your Experience */}
            <div className="mt-7 space-y-3">
              <button
                onClick={handleCollectStampClick}
                disabled={collectingStamp}
                className="w-full rounded-2xl bg-[#B58A4B] py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <span>☕</span>
                <span>{collectingStamp ? "Collecting Stamp..." : "Collect My Stamp"}</span>
              </button>

              <button
                onClick={() => setCurrentView("review")}
                className="w-full rounded-2xl border border-[#E8DFD1] bg-white py-3.5 text-sm font-bold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>⭐</span>
                <span>Share Your Experience</span>
              </button>
            </div>
          </div>

          {/* Three Value Badges at Bottom */}
          <div className="flex items-center justify-center gap-6 border-t border-[#E8DFD1] pt-5 text-center text-xs font-medium text-[#716B64]">
            <div className="flex items-center gap-1.5">
              <span>☕</span>
              <span>Great Food</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>🤎</span>
              <span>Kind People</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>✨</span>
              <span>Better Together</span>
            </div>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 3: ENTER DETAILS ("Join Our Rewards" — matching Phone 3)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "register" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-between px-5 py-6">
          <div>
            <button
              onClick={() => setCurrentView("welcome")}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#716B64] hover:text-[#24211E] transition"
            >
              <span>←</span> Back
            </button>

            <div className="mt-4 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F6EFE3] text-xl text-[#B58A4B] border border-[#E8D8BA]">
                🌿
              </div>
              <h1 className="mt-3 font-serif text-2xl font-bold text-[#24211E]">
                Join Our Rewards
              </h1>
              <p className="mt-1 text-xs text-[#716B64]">
                A few details to get started
              </p>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleRegister} className="mt-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-[#E8DFD1] bg-white px-4 py-3 text-sm font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:ring-1 focus:ring-[#B58A4B] shadow-2xs transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-[#E8DFD1] bg-white shadow-2xs focus-within:border-[#B58A4B] focus-within:ring-1 focus-within:ring-[#B58A4B] transition overflow-hidden">
                  <span className="flex items-center pl-4 pr-2 text-sm font-semibold text-[#716B64]">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-transparent py-3 pr-4 text-sm font-medium text-[#24211E] outline-none"
                    required
                  />
                </div>
              </div>

              {/* Opt-in updates checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="optin"
                  checked={agreedUpdates}
                  onChange={(e) => setAgreedUpdates(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#E8DFD1] text-[#B58A4B] accent-[#B58A4B] focus:ring-0"
                />
                <label htmlFor="optin" className="text-[11px] leading-tight text-[#716B64]">
                  I agree to receive important updates about my rewards, offers and news. You can opt out anytime.
                </label>
              </div>

              {registerError && (
                <div className="rounded-xl border border-[#F7D6D6] bg-[#FDF2F2] p-3 text-xs font-medium text-[#A83B3B]">
                  {registerError}
                </div>
              )}

              <button
                type="submit"
                disabled={registering}
                className="mt-3 w-full rounded-2xl bg-[#B58A4B] py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] disabled:opacity-60"
              >
                {registering ? "Loading Your Card..." : "Send OTP"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] text-[#716B64]/70">
            🔒 Fast 1-click registration • Secure &amp; confidential.
          </p>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 4: WAITING FOR OWNER APPROVAL (Pulsing Shield / Request Sent)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "request_pending" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-between px-5 py-7 text-center">
          <div className="pt-2">
            <span className="font-serif text-xs font-bold uppercase tracking-wider text-[#716B64]">
              {restaurant.name}
            </span>

            {/* Pulsing Animated Stamp Cup */}
            <div className="relative mx-auto my-6 flex h-28 w-28 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B58A4B]/20" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-[#FAF5ED] text-4xl shadow-subtle border-2 border-[#E8D8BA]">
                🛡️
              </div>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full bg-[#FAF5ED] px-3.5 py-1 text-xs font-bold text-[#7A5826] border border-[#E8D8BA]">
              <span className="h-2 w-2 rounded-full bg-[#B58A4B] animate-pulse" />
              Stamp Request Sent to Staff
            </span>

            <h1 className="mt-4 font-serif text-2xl font-extrabold text-[#24211E]">
              Verify Your Visit
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-xs text-[#716B64] leading-relaxed">
              We notified the counter at <strong>{restaurant.name}</strong>. Once verified, your stamp will appear automatically on your card!
            </p>

            {requestError && (
              <div className="mt-4 rounded-xl border border-[#F7D6D6] bg-[#FDF2F2] p-3 text-xs font-semibold text-[#A83B3B]">
                {requestError}
              </div>
            )}

            {/* Visit Details Box */}
            <div className="mx-auto my-6 w-full max-w-xs rounded-2xl border border-[#E8DFD1] bg-white p-4 text-left shadow-2xs space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#716B64]">Guest:</span>
                <span className="font-bold text-[#24211E]">
                  {fullName || customer?.name || "Guest"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#716B64]">Mobile:</span>
                <span className="font-mono font-medium text-[#24211E]">
                  +91 {phoneNumber}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#716B64]">Location:</span>
                <span className="font-semibold text-[#7A5826]">
                  {pendingTableNo || "Table Visit"}
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-[#E8DFD1]/60 pt-2.5">
                <span className="text-[#716B64]">Status:</span>
                <span className="font-bold text-[#B58A4B] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#B58A4B] animate-ping" />
                  Awaiting Staff Confirmation
                </span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xs space-y-3 mx-auto pb-2">
            <button
              onClick={() => setCurrentView("card")}
              className="w-full rounded-2xl border border-stone-300 bg-white py-3 text-xs font-bold text-stone-700 shadow-2xs hover:bg-stone-50 transition"
            >
              View My Loyalty Card Meanwhile →
            </button>
            <p className="text-[11px] text-[#716B64]/70">
              ⚡ Checking for approval automatically every 2.5 seconds.
            </p>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 5: MY LOYALTY CARD (Matching Phone 5 in reference mockup)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "card" && (
        <main className="mx-auto min-h-screen max-w-sm px-5 py-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-3.5">
            <button
              onClick={() => setCurrentView("welcome")}
              className="text-xs font-semibold text-[#716B64] hover:text-[#24211E] transition flex items-center gap-1"
            >
              <span>←</span>
            </button>
            <div className="text-center">
              <h2 className="font-serif text-base font-bold text-[#24211E] leading-tight">
                My Rewards
              </h2>
              <p className="text-[11px] text-[#716B64]">{restaurant.name}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchLoyaltyCard(customer?.phone || phoneNumber)}
                className="rounded-xl border border-[#E8DFD1] bg-white px-2 py-1 text-xs text-[#716B64] hover:bg-[#FAF7F2] transition"
                title="Refresh Stamps"
              >
                🔄
              </button>
              <button
                onClick={() => setCurrentView("review")}
                className="rounded-xl bg-[#FAF5ED] border border-[#E8D8BA] px-2.5 py-1 text-xs font-bold text-[#7A5826] hover:bg-[#F6EFE3] transition"
              >
                ⭐ Review
              </button>
            </div>
          </div>

          {/* Pending Stamp Request Banner on Card */}
          {pendingRequestId && (
            <div className="mt-3.5 flex items-center justify-between rounded-2xl border border-[#E8D8BA] bg-[#FAF5ED] p-3 text-xs text-[#7A5826] shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#B58A4B] animate-ping shrink-0" />
                <span>Stamp request sent to staff! Waiting for approval...</span>
              </div>
              <button
                onClick={() => setCurrentView("request_pending")}
                className="ml-2 font-bold underline text-[#7A5826] shrink-0"
              >
                View
              </button>
            </div>
          )}

          {loadingCard && !customer ? (
            <div className="py-20 text-center text-xs font-medium text-[#716B64]">
              Loading your reward stamps...
            </div>
          ) : cardError ? (
            <div className="mt-8 rounded-2xl border border-[#F7D6D6] bg-white p-6 text-center shadow-subtle">
              <p className="text-xs text-[#A83B3B]">{cardError}</p>
              <button
                onClick={() => fetchLoyaltyCard(phoneNumber)}
                className="mt-3 rounded-xl bg-[#24211E] px-4 py-2 text-xs font-bold text-white hover:bg-stone-800"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {/* STAMP CARD (Matching Phone 5 Mockup) */}
              <div className="rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-subtle">
                <div className="flex items-center justify-between border-b border-[#E8DFD1]/60 pb-3">
                  <div>
                    <h3 className="font-serif text-sm font-bold text-[#24211E]">
                      {restaurant.name}
                    </h3>
                    <p className="text-[11px] text-[#716B64]">
                      {customer?.name || "Valued Customer"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-2xl font-black text-[#B58A4B]">
                      {currentStamps}
                    </span>
                    <span className="text-xs font-bold text-[#716B64]">/{stampsRequired}</span>
                    <span className="block text-[9px] uppercase tracking-wider text-[#716B64]">Stamps</span>
                  </div>
                </div>

                {/* Stamp Icons Row (Circles with Cups / Gift Box in Gold) */}
                <div className="my-5 grid grid-cols-5 gap-2.5">
                  {Array.from({ length: stampsRequired }).map((_, index) => {
                    const isStamped = index < currentStamps;
                    const isTarget = index === stampsRequired - 1;

                    return (
                      <div
                        key={index}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl transition-all ${isStamped
                            ? "bg-[#B58A4B] text-white shadow-xs scale-105"
                            : isTarget
                              ? "border-2 border-dashed border-[#B58A4B] bg-[#FAF5ED] text-[#B58A4B]"
                              : "border border-[#E8DFD1] bg-[#FAF7F2] text-[#B8B1A8]"
                          }`}
                      >
                        {isStamped ? (
                          <span className="text-lg">☕</span>
                        ) : isTarget ? (
                          <span className="text-lg">🎁</span>
                        ) : (
                          <span className="text-sm font-medium">☕</span>
                        )}
                        <span
                          className={`text-[8px] font-bold ${isStamped ? "text-white/90" : "text-[#716B64]"
                            }`}
                        >
                          {index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Subtitle */}
                <div className="rounded-2xl bg-[#FAF5ED] border border-[#E8D8BA] p-3 text-center">
                  <p className="text-xs font-bold text-[#7A5826]">
                    {currentStamps >= stampsRequired
                      ? "🎉 Goal Reached! Your reward voucher is ready to redeem!"
                      : stampsRemaining === 1
                        ? "4/5 Stamps — One more visit to unlock your reward!"
                        : `${currentStamps}/${stampsRequired} Stamps — ${stampsRemaining} more visits to unlock your reward!`}
                  </p>
                  {customer?.cycleEndsAt && customer.currentStamps > 0 && (
                    <p className="mt-1 text-[10px] text-[#7A5826]/80">
                      ⏳ Stamps valid until{" "}
                      <strong>
                        {new Date(customer.cycleEndsAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                    </p>
                  )}
                </div>

                {/* Collect Today's Stamp CTA on Card */}
                <div className="mt-4 pt-3 border-t border-[#E8DFD1]/60">
                  {hasCollectedStampToday ? (
                    <div className="w-full rounded-2xl py-3 text-xs font-bold text-[#2E6B4F] bg-[#EEF6F2] border border-[#D1E7DC] text-center flex items-center justify-center gap-2 shadow-2xs">
                      <span>✓</span>
                      <span>Today&apos;s Visit Stamp Collected ({currentStamps}/{stampsRequired})</span>
                    </div>
                  ) : (
                    <button
                      onClick={pendingRequestId ? () => setCurrentView("request_pending") : handleCollectStampClick}
                      disabled={collectingStamp}
                      className="w-full rounded-2xl bg-[#B58A4B] py-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <span>☕</span>
                      <span>
                        {pendingRequestId
                          ? "Approval Pending with Staff →"
                          : collectingStamp
                            ? "Sending Request..."
                            : "Collect Visit Stamp"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* NEXT REWARD CARD (Golden Gift Box Banner matching Phone 5) */}
              <div className="rounded-3xl border border-[#E8D8BA] bg-gradient-to-br from-[#FAF5ED] via-[#F4ECE1] to-[#FAF7F2] p-5 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="inline-block rounded-md bg-[#F4ECDD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7A5826]">
                    Next Reward
                  </span>
                  <span className="text-[11px] font-semibold text-[#7A5826]">
                    Valid for {program.rewardExpiryDays || 30} days
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-serif text-xl font-extrabold text-[#24211E]">
                      {discountDisplay}
                    </h4>
                    <p className="text-xs text-[#716B64] mt-0.5">
                      {program.rewardTitle || "on your next visit"}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6EFE3] text-2xl border border-[#E8D8BA] shadow-2xs">
                    🎁
                  </div>
                </div>
              </div>

              {/* Active Unredeemed Rewards / Vouchers */}
              {activeRewards.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#716B64]">
                    Available Vouchers ({activeRewards.length})
                  </h4>
                  {activeRewards.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-2xl border-2 border-dashed border-[#B58A4B] bg-white p-4 shadow-2xs"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-[#7A5826] uppercase">
                          Unlocked Voucher
                        </span>
                        <h5 className="text-sm font-bold text-[#24211E]">{r.rewardTitle}</h5>
                        <p className="font-mono text-xs font-semibold text-[#716B64]">
                          {r.code}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenRewardQr(r)}
                        className="rounded-xl bg-[#B58A4B] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition"
                      >
                        Redeem →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Links: View Reward Details & Visit History */}
              <div className="divide-y divide-[#E8DFD1]/60 rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle overflow-hidden">
                <button
                  onClick={() => {
                    if (activeRewards[0]) {
                      handleOpenRewardQr(activeRewards[0]);
                    } else {
                      alert(`Collect ${stampsRemaining} more stamps to unlock your reward voucher!`);
                    }
                  }}
                  className="flex w-full items-center justify-between p-4 text-xs font-bold text-[#24211E] hover:bg-[#FAF7F2] transition"
                >
                  <span className="flex items-center gap-2">
                    <span>🎟️</span>
                    <span>View Reward Details</span>
                  </span>
                  <span className="text-stone-400">›</span>
                </button>

                <div className="p-4">
                  <h5 className="text-xs font-bold text-[#24211E] flex items-center gap-2 mb-2">
                    <span>📜</span>
                    <span>Visit History ({customer?.transactions?.length || 0})</span>
                  </h5>
                  {customer?.transactions && customer.transactions.length > 0 ? (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {customer.transactions.map((tx) => (
                        <div key={tx.id} className="flex justify-between text-[11px] text-[#716B64] border-b border-[#E8DFD1]/40 pb-1">
                          <span>
                            {tx.stampsCount > 0 ? `+${tx.stampsCount} Stamp(s) Awarded` : "Offer Redeemed"}
                            {tx.billReference ? ` (${tx.billReference})` : ""}
                          </span>
                          <span className="text-[#716B64]/60">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#716B64]/70">No previous visits recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Action: Share Your Experience */}
              <button
                onClick={() => setCurrentView("review")}
                className="w-full rounded-2xl border border-[#E8DFD1] bg-white py-3 text-xs font-bold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition flex items-center justify-center gap-2"
              >
                <span>⭐</span>
                <span>Share Your Experience &amp; Review</span>
              </button>

              {/* Staff instruction */}
              <p className="text-center text-[11px] text-[#716B64]">
                Show your number (<strong>+91 {customer?.phone}</strong>) at the counter to verify your visit.
              </p>
            </div>
          )}
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 6: STAFF ISSUES STAMP (Celebration Screen matching Phone 6)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "stamp_added" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 py-8 text-center">
          {/* Celebratory stamp stamp icon with warm gold burst */}
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[#FAF5ED] text-5xl shadow-subtle border-4 border-white animate-bounce">
            <span className="text-[#B58A4B]">☕</span>
          </div>

          <span className="rounded-full bg-[#EEF6F2] px-3.5 py-1 text-xs font-bold text-[#2E6B4F] border border-[#D1E7DC] mb-3">
            ✨ Visit Recorded &amp; Stamped
          </span>

          <h1 className="font-serif text-3xl font-extrabold text-[#24211E]">
            Stamp Added!
          </h1>
          <p className="mt-2 max-w-xs text-xs text-[#716B64] leading-relaxed">
            {stampFeedbackMessage || "Your visit has been recorded. You're one step closer to your reward!"}
          </p>

          {/* Mini Stamp Dots visual preview */}
          <div className="my-6 flex items-center justify-center gap-2 rounded-2xl bg-white p-3.5 border border-[#E8DFD1] shadow-2xs">
            {Array.from({ length: stampsRequired }).map((_, index) => {
              const isStamped = index < currentStamps;
              return (
                <div
                  key={index}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${isStamped
                      ? "bg-[#B58A4B] text-white shadow-2xs scale-110"
                      : "border border-[#E8DFD1] bg-[#FAF7F2] text-[#B8B1A8]"
                    }`}
                >
                  {isStamped ? "☕" : index + 1}
                </div>
              );
            })}
          </div>

          <div className="w-full max-w-xs space-y-2.5">
            <button
              onClick={() => setCurrentView("card")}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.98]"
              style={{ backgroundColor: brandColor }}
            >
              View My Rewards ({currentStamps}/{stampsRequired}) →
            </button>

            <button
              onClick={() => setCurrentView("review")}
              className="w-full rounded-2xl border border-[#E8DFD1] bg-white py-3 text-xs font-bold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition flex items-center justify-center gap-1.5"
            >
              <span>⭐</span>
              <span>Share Experience (Optional)</span>
            </button>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 7: SHARE YOUR EXPERIENCE (Matching Phone 7 in reference mockup)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "review" && (
        <main className="mx-auto min-h-screen max-w-sm px-5 py-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-3.5">
            <button
              onClick={() => setCurrentView("welcome")}
              className="text-xs font-semibold text-[#716B64] hover:text-[#24211E] transition flex items-center gap-1"
            >
              <span>←</span>
            </button>
            <div className="text-center">
              <h2 className="font-serif text-base font-bold text-[#24211E] leading-tight">
                Share Your Experience
              </h2>
              <p className="text-[11px] text-[#716B64]">{restaurant.name}</p>
            </div>
            <div className="w-6" />
          </div>

          <div className="mt-5 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6EFE3] text-lg text-[#B58A4B] border border-[#E8D8BA]">
              🌿
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#24211E]">
              Share Your Experience
            </h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-[#716B64]">
              Note others discover great food. We&apos;ll help you write an honest review.
            </p>

            <div className="my-5">
              <p className="mb-2 text-sm font-semibold text-[#24211E]">How was your overall experience?</p>
              <Stars
                value={starRating}
                onChange={(rating) => {
                  setStarRating(rating);
                  setReviewGenerationError("");
                }}
                label="Rate your overall experience from 1 to 5 stars"
              />
              <p className="mt-1.5 text-[11px] text-[#716B64]" aria-live="polite">
                {starRating === 0 ? "Choose 1 to 5 stars before generating your review." : `Your rating: ${starRating} out of 5`}
              </p>
            </div>
          </div>

          {/* What Did You Like (Chips & Text) */}
          <div className="space-y-4 rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-subtle">
            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-2">
                {aiGenerated ? "Your review draft (you can edit it)" : "What did you like? (Optional)"}
              </label>
              {!aiGenerated && (
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
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${isSelected
                          ? "bg-[#24211E] text-white font-semibold shadow-2xs"
                          : "border border-[#E8DFD1] bg-[#FAF7F2] text-[#716B64] hover:bg-[#F2ECE1]"
                        }`}
                    >
                      {chip}
                    </button>
                  );
                  })}
                </div>
              )}
            </div>

            <div>
              <textarea
                placeholder={aiGenerated ? "Your generated review will appear here." : "Great coffee, cozy ambience and friendly staff. Loved the pasta!"}
                value={aiGenerated ? aiDraft : customComment}
                onChange={(e) => aiGenerated ? setAiDraft(e.target.value) : setCustomComment(e.target.value)}
                rows={aiGenerated ? 5 : 2}
                className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2]/60 p-3 text-xs text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white transition"
              />
            </div>

            {/* Button: Generate Review with AI */}
            <button
              onClick={handleGenerateAiReview}
              disabled={generatingAi || starRating === 0}
              className="sticky bottom-3 z-20 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/40 bg-[#B58A4B] py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#9E7438] active:scale-[0.98] disabled:opacity-60"
            >
              <span>✨</span>
              <span>
                {generatingAi
                  ? "Crafting Review with AI..."
                  : aiGenerated
                    ? "Generate another draft"
                    : "Generate Review with AI"}
              </span>
            </button>

            {reviewGenerationError && (
              <p role="alert" className="rounded-xl border border-[#F7D6D6] bg-[#FDF2F2] p-3 text-xs font-semibold text-[#A83B3B]">
                {reviewGenerationError}
              </p>
            )}

            {restaurant.googleReviewUrl && (
              <div className="pt-0.5 text-center">
                <a
                  href={restaurant.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-[#716B64] hover:text-[#24211E] underline"
                >
                  Or open Google Reviews directly without AI draft ↗
                </a>
              </div>
            )}
            {aiGenerated && (
              <div className="space-y-3 border-t border-[#E8DFD1] pt-4">
                <button
                  onClick={handleCopyAndGoogleReview}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1A73E8] py-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1557B0] active:scale-[0.98]"
                >
                  <span className="text-sm font-black">G</span>
                  <span>{copiedReview ? "Review Copied! Opening Google..." : "Copy & Review on Google"}</span>
                </button>

                {reviewSubmitted && (
                  <div className="space-y-1.5 text-center text-xs text-[#2E6B4F]">
                    <p className="font-bold">✅ Review copied to clipboard!</p>
                    <p>Paste your copied review into the Google review box that opened.</p>
                    {restaurant.googleReviewUrl && (
                      <a
                        href={restaurant.googleReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-bold text-[#1A73E8] underline hover:text-[#1557B0]"
                      >
                        Open Google Reviews ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Stamp CTA */}
          <div className="mt-5 rounded-2xl border border-[#E8DFD1] bg-white p-4 text-center">
            <p className="text-xs font-semibold text-[#716B64]">
              Want to collect a loyalty stamp for your visit?
            </p>
            <button
              onClick={() => {
                if (customer) setCurrentView("card");
                else setCurrentView("register");
              }}
              className="mt-1.5 text-xs font-bold underline text-[#24211E]"
            >
              Collect My Stamp Now →
            </button>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: REWARD REDEMPTION SCREENS (Matching Reference Mockup)
      ───────────────────────────────────────────────────────────── */}
      {/* SCREEN 2: YOUR REWARD (Voucher QR Modal) */}
      {currentView === "reward_details" && selectedReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl border border-[#E8DFD1]">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#FAF5ED] border border-[#E8D8BA] px-2.5 py-0.5 text-[10px] font-bold text-[#7A5826]">
                🎁 Redeem at Counter
              </span>
              <button
                onClick={() => setCurrentView("card")}
                className="text-[#716B64] hover:text-[#24211E] text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <h4 className="mt-3 font-serif text-2xl font-bold text-[#24211E]">
              Your Reward
            </h4>
            <p className="text-sm font-bold text-[#B58A4B] mt-0.5">
              {selectedReward.rewardTitle}
            </p>

            {/* Generated QR Code */}
            <div className="my-4 flex justify-center">
              {rewardQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rewardQrDataUrl}
                  alt={`Voucher ${selectedReward.code}`}
                  className="h-52 w-52 rounded-2xl border border-[#E8DFD1] p-2 shadow-inner"
                />
              ) : (
                <div className="h-52 w-52 rounded-2xl bg-[#FAF7F2] flex items-center justify-center text-xs text-[#716B64]">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] p-2.5">
              <span className="text-[10px] font-semibold text-[#716B64] uppercase tracking-wider block">
                Voucher Code
              </span>
              <span className="font-mono text-base font-black text-[#24211E] tracking-wider">
                {selectedReward.code}
              </span>
            </div>

            <p className="mt-2 text-[11px] text-[#716B64]">
              Valid until {new Date(selectedReward.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>

            <p className="mt-2 text-[11px] text-[#716B64] leading-tight">
              Show this code to staff to redeem your reward.
            </p>

            <button
              onClick={() => setCurrentView("card")}
              className="mt-5 w-full rounded-xl bg-[#24211E] py-3 text-xs font-bold text-white transition hover:bg-stone-800"
            >
              Back to My Rewards
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 3: REWARD REDEEMED CELEBRATION */}
      {currentView === "reward_redeemed" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 py-8 text-center">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[#FAF5ED] text-5xl shadow-subtle border-4 border-white text-[#B58A4B]">
            ✓
          </div>

          <h1 className="font-serif text-3xl font-extrabold text-[#24211E]">
            Reward Redeemed!
          </h1>
          <p className="mt-2 max-w-xs text-xs text-[#716B64] leading-relaxed">
            Enjoy your discount on your visit today.
          </p>

          <button
            onClick={() => setCurrentView("card")}
            className="mt-8 w-full max-w-xs rounded-2xl bg-[#B58A4B] py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98]"
          >
            Back to My Rewards
          </button>
        </main>
      )}
    </div>
  );
}
