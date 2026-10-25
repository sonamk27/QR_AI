"use client";

import { useEffect, useRef, useState } from "react";
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

  // ── Owner Approval Stamp Request State ──────────────────────────────────
  type StampRequestStatus = "idle" | "submitting" | "pending" | "approved" | "rejected" | "error";
  const [stampReqStatus, setStampReqStatus] = useState<StampRequestStatus>("idle");
  const [stampReqId, setStampReqId] = useState<string | null>(null);
  const [stampReqMessage, setStampReqMessage] = useState<string | null>(null);
  const [stampReqTableNo, setStampReqTableNo] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

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
        color: { dark: "#24211E", light: "#ffffff" },
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

  // ── Owner Approval Flow ──────────────────────────────────────────────────
  async function handleRequestStamp() {
    if (stampReqStatus === "submitting" || stampReqStatus === "pending") return;

    setStampReqStatus("submitting");
    setStampReqMessage(null);

    try {
      const res = await fetch("/api/loyalty/anon/request-stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to send stamp request");

      if (data.alreadyCollected) {
        setStampReqStatus("approved");
        setStampReqMessage(data.message || "You already received a stamp for this visit!");
        return;
      }

      setStampReqId(data.requestId);
      setStampReqTableNo(data.tableNo || null);
      setStampReqStatus("pending");
      setStampReqMessage("Waiting for owner approval…");

      // Start polling
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => {
        pollRequestStatus(data.requestId);
      }, 4000);
    } catch (err: any) {
      setStampReqStatus("error");
      setStampReqMessage(err.message || "Could not send request. Please try again.");
    }
  }

  async function pollRequestStatus(reqId: string) {
    try {
      const res = await fetch(
        `/api/loyalty/anon/request-stamp/status?slug=${encodeURIComponent(slug)}&requestId=${reqId}`
      );
      const data = await res.json();

      if (!res.ok) return; // silent fail on polling

      if (data.status === "APPROVED") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setStampReqStatus("approved");
        setStampReqMessage(
          `🎉 Stamp approved! You now have ${data.currentStamps ?? "updated"} stamp${(data.currentStamps ?? 1) !== 1 ? "s" : ""} on your card.`
        );
        // Refresh the card data to show updated stamps
        fetchCard();
      } else if (data.status === "REJECTED") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setStampReqStatus("rejected");
        setStampReqMessage("Request declined by the owner. Please speak to staff if you believe this is an error.");
      }
    } catch {
      // silent fail during polling
    }
  }

  const brandColor = data?.restaurant.brandColor || "#B58A4B";
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
    <div className="min-h-screen bg-[#F7F2E9] pb-16 font-sans text-[#24211E] antialiased selection:bg-[#FAF5ED]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#E8DFD1] bg-[#F7F2E9]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link
            href={`/r/${slug}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#716B64] transition hover:text-[#24211E]"
          >
            <span>←</span> Back to Review
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#B58A4B] animate-pulse" />
            <span className="text-xs font-medium text-[#716B64]">Anonymous Dining Pass</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        {/* Loading Skeleton */}
        {loading && !data ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-[#E8DFD1] animate-pulse">
              <div className="h-10 w-10 rounded-full bg-[#FAF5ED]" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-[#FAF5ED]" />
                <div className="h-3 w-20 rounded bg-[#FAF5ED]" />
              </div>
            </div>

            <div className="rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-sm space-y-4 animate-pulse">
              <div className="h-6 w-3/4 rounded bg-[#FAF5ED]" />
              <div className="h-4 w-1/2 rounded bg-[#FAF5ED]" />
              <div className="grid grid-cols-5 gap-2 pt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl bg-[#FAF5ED]" />
                ))}
              </div>
            </div>
            <p className="text-center text-xs font-medium text-[#716B64]">Loading your private stamp card...</p>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <div className="text-3xl">⚠️</div>
            <h2 className="mt-2 text-base font-serif font-bold text-[#24211E]">Unable to load card</h2>
            <p className="mt-1 text-xs text-[#716B64]">{error}</p>
            <button
              onClick={fetchCard}
              className="mt-4 rounded-xl bg-[#B58A4B] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#9E7438]"
            >
              Try Again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Restaurant Profile Mini Header */}
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-xs border border-[#E8DFD1]">
              <div className="flex items-center gap-3">
                {data.restaurant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.restaurant.logoUrl}
                    alt={data.restaurant.name}
                    className="h-10 w-10 rounded-full border border-[#E8DFD1] object-cover"
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-base font-serif font-bold text-white shadow-sm"
                    style={{ backgroundColor: brandColor }}
                  >
                    {data.restaurant.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-bold text-[#24211E] leading-tight">
                    {data.restaurant.name}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center rounded-md bg-[#FAF5ED] px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#716B64] border border-[#E8DFD1]">
                      ID: {data.customer.id.slice(0, 12)}…
                    </span>
                    <button
                      onClick={() => handleCopy(data.customer.id)}
                      className="text-[10px] font-semibold text-[#B58A4B] hover:text-[#9E7438] underline"
                      title="Copy full anonymous ID"
                    >
                      {copiedCode ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy badge */}
              <div className="flex flex-col items-end text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF5ED] px-2 py-0.5 text-[10px] font-bold text-[#B58A4B] border border-[#E8DFD1]">
                  <span>🔒</span> Anonymous
                </span>
                <span className="text-[9px] text-[#716B64] mt-0.5">No phone number</span>
              </div>
            </div>

            {/* Privacy Notification Banner */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#E8DFD1] bg-white/70 p-3 shadow-xs backdrop-blur-sm">
              <span className="text-sm">🍪</span>
              <div className="text-[11px] leading-relaxed text-[#716B64]">
                <span className="font-semibold text-[#24211E]">Private Browser Card:</span> Your stamps are securely linked to this browser via cookie. No mobile number or registration needed.
              </div>
            </div>

            {/* DYNAMIC ACTIVE OFFER HERO BANNER */}
            {data.program.isActive && (
              <div className="rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF5ED] px-3 py-1 text-xs font-bold text-[#B58A4B] border border-[#E8DFD1]">
                    <span>☕</span>
                    <span>Active Dining Offer</span>
                  </span>
                  <span className="text-xs font-bold text-[#B58A4B]">
                    Save {discountDisplay}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="font-serif text-xl font-bold text-[#24211E] leading-snug">
                    {data.program.rewardTitle}
                  </h3>
                  <p className="mt-1 text-xs text-[#716B64] leading-relaxed">
                    Earn {stampsRequired} stamp{stampsRequired > 1 ? "s" : ""} on bills of ₹{minBillRupees.toFixed(0)} or more to unlock your dining voucher!
                  </p>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex rounded-xl bg-white p-1 text-xs font-bold border border-[#E8DFD1]">
              <button
                onClick={() => setActiveTab("card")}
                className={`flex-1 rounded-lg py-2 transition ${
                  activeTab === "card"
                    ? "bg-[#B58A4B] text-white shadow-xs font-semibold"
                    : "text-[#716B64] hover:text-[#24211E]"
                }`}
              >
                Stamp Card ({currentStamps}/{stampsRequired})
              </button>
              <button
                onClick={() => setActiveTab("rewards")}
                className={`relative flex-1 rounded-lg py-2 transition ${
                  activeTab === "rewards"
                    ? "bg-[#B58A4B] text-white shadow-xs font-semibold"
                    : "text-[#716B64] hover:text-[#24211E]"
                }`}
              >
                My Vouchers
                {activeRewards.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.2 text-[10px] font-bold text-[#B58A4B]">
                    {activeRewards.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 rounded-lg py-2 transition ${
                  activeTab === "history"
                    ? "bg-[#B58A4B] text-white shadow-xs font-semibold"
                    : "text-[#716B64] hover:text-[#24211E]"
                }`}
              >
                Visits
              </button>
            </div>

            {/* TAB: STAMP CARD */}
            {activeTab === "card" && (
              <div className="space-y-4">
                {/* Main Digital Stamp Card Box */}
                <div className="rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#716B64]">
                        Cycle #{data.customer.cycleNumber}
                      </span>
                      <h4 className="text-base font-serif font-bold text-[#24211E]">
                        {currentStamps >= stampsRequired ? "Reward Unlocked! 🎉" : "Collect Stamps"}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-[#B58A4B]">
                        {currentStamps}
                      </span>
                      <span className="text-xs font-semibold text-[#716B64]">
                        /{stampsRequired}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#FAF5ED] border border-[#E8DFD1]">
                    <div
                      className="h-full rounded-full bg-[#B58A4B] transition-all duration-500 ease-out"
                      style={{
                        width: `${progressPercent}%`,
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
                              ? "border-[#B58A4B] bg-[#B58A4B] text-white shadow-xs scale-[1.02]"
                              : isNext
                              ? "border-dashed border-[#B58A4B] bg-[#FAF5ED] text-[#B58A4B] animate-pulse"
                              : "border-[#E8DFD1] bg-[#FAF5ED]/50 text-[#716B64]/60"
                          }`}
                        >
                          {isStamped ? (
                            <span className="text-xl">⭐</span>
                          ) : isLast ? (
                            <span className="text-xl">🎁</span>
                          ) : (
                            <span className="text-xs font-bold font-mono">{index + 1}</span>
                          )}

                          {isNext && (
                            <span className="absolute -bottom-1 rounded-full bg-[#24211E] px-1 text-[8px] font-bold text-white">
                              NEXT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* How it works info */}
                  <div className="mt-6 rounded-2xl bg-[#FAF5ED] border border-[#E8DFD1] p-3.5 text-center">
                    {stampsRemaining > 0 ? (
                      <p className="text-xs font-medium text-[#716B64]">
                        Ask staff to verify your bill to earn{" "}
                        <span className="font-bold text-[#24211E]">
                          {stampsRemaining} more stamp{stampsRemaining > 1 ? "s" : ""}
                        </span>{" "}
                        and receive <span className="font-bold text-[#24211E]">{data.program.rewardTitle}</span>!
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-[#B58A4B]">
                          🎉 Stamp goal achieved! Your voucher is ready to redeem.
                        </p>
                        <button
                          onClick={() => setActiveTab("rewards")}
                          className="text-xs font-bold underline text-[#24211E]"
                        >
                          View Voucher &amp; Show to Staff →
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Diner Bill Savings Calculator */}
                <div className="rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧮</span>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#24211E]">
                      Check Your Bill Savings
                    </h5>
                  </div>
                  <p className="mt-1 text-[11px] text-[#716B64]">
                    See how much you save on your bill today with this offer.
                  </p>

                  <div className="mt-3 flex items-center rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] px-3 py-2 focus-within:border-[#B58A4B] focus-within:bg-white transition">
                    <span className="text-xs font-bold text-[#716B64] mr-2">₹</span>
                    <input
                      type="number"
                      placeholder={`Enter bill amount (e.g. ${minBillRupees || 500})`}
                      value={dinerBillInput}
                      onChange={(e) => setDinerBillInput(e.target.value)}
                      className="w-full bg-transparent text-xs font-medium text-[#24211E] outline-none"
                    />
                  </div>

                  {numericBill > 0 && (
                    <div className="mt-3 rounded-xl border border-[#E8DFD1] bg-[#FAF5ED]/70 p-3 text-xs space-y-1.5">
                      <div className="flex justify-between text-[#716B64]">
                        <span>Qualifying Minimum:</span>
                        <span className="font-semibold text-[#24211E]">₹{minBillRupees.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-[#716B64]">
                        <span>Offer Status:</span>
                        <span
                          className={`font-bold ${
                            dinerMeetsMin ? "text-[#B58A4B]" : "text-amber-700"
                          }`}
                        >
                          {dinerMeetsMin
                            ? "✅ Qualifies for Offer Stamp"
                            : `Add ₹${(minBillRupees - numericBill).toFixed(0)} more to qualify`}
                        </span>
                      </div>
                      {dinerMeetsMin && (
                        <>
                          <div className="flex justify-between font-bold text-[#B58A4B] pt-1 border-t border-[#E8DFD1]">
                            <span>Voucher Discount:</span>
                            <span>-₹{calculatedSavings.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-[#24211E]">
                            <span>Estimated Net Payable:</span>
                            <span>₹{netPayable.toFixed(0)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Request Stamp from Owner ── */}
                <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-xs">
                  <h5 className="text-xs font-bold text-[#24211E] flex items-center gap-1.5">
                    <span>📲</span> Request a Stamp from Owner
                  </h5>
                  <p className="mt-1 text-[11px] text-[#716B64] leading-relaxed">
                    Tap the button after your visit. The owner will see your request on their dashboard and approve it in real-time.
                  </p>

                  {/* Idle / Error state — show the button */}
                  {(stampReqStatus === "idle" || stampReqStatus === "error") && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={handleRequestStamp}
                        className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] bg-[#B58A4B]"
                      >
                        ☕ Request Visit Stamp
                      </button>
                      {stampReqStatus === "error" && stampReqMessage && (
                        <p className="text-center text-[11px] font-semibold text-rose-600">
                          ⚠️ {stampReqMessage}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Submitting state */}
                  {stampReqStatus === "submitting" && (
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#FAF5ED] py-3 border border-[#E8DFD1]">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-[#E8DFD1] border-t-[#B58A4B] animate-spin" />
                      <span className="text-xs font-semibold text-[#716B64]">Sending request…</span>
                    </div>
                  )}

                  {/* Pending state — waiting for owner */}
                  {stampReqStatus === "pending" && (
                    <div className="mt-3 rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-[#B58A4B]/40 border-t-[#B58A4B] animate-spin shrink-0" />
                        <span className="text-xs font-bold text-[#24211E]">
                          Awaiting owner approval…
                        </span>
                        <span className="ml-auto rounded-full bg-[#B58A4B]/20 px-2 py-0.5 text-[10px] font-bold text-[#B58A4B] animate-pulse">
                          LIVE
                        </span>
                      </div>
                      {stampReqTableNo && (
                        <p className="mt-1.5 text-[11px] text-[#716B64]">
                          📍 {stampReqTableNo} — Request sent to owner dashboard
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[#716B64]">
                        Keep this page open. Your stamp will appear automatically when approved.
                      </p>
                    </div>
                  )}

                  {/* Approved state */}
                  {stampReqStatus === "approved" && (
                    <div className="mt-3 rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <span className="text-xs font-bold text-[#B58A4B]">
                          Stamp Approved!
                        </span>
                      </div>
                      {stampReqMessage && (
                        <p className="mt-1 text-[11px] text-[#716B64]">{stampReqMessage}</p>
                      )}
                      <button
                        onClick={() => {
                          setStampReqStatus("idle");
                          setStampReqId(null);
                          setStampReqMessage(null);
                        }}
                        className="mt-2 text-[11px] font-semibold text-[#B58A4B] underline"
                      >
                        Request another stamp
                      </button>
                    </div>
                  )}

                  {/* Rejected state */}
                  {stampReqStatus === "rejected" && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">❌</span>
                        <span className="text-xs font-bold text-rose-800">
                          Request Declined
                        </span>
                      </div>
                      {stampReqMessage && (
                        <p className="mt-1 text-[11px] text-rose-700">{stampReqMessage}</p>
                      )}
                      <button
                        onClick={() => {
                          setStampReqStatus("idle");
                          setStampReqId(null);
                          setStampReqMessage(null);
                        }}
                        className="mt-2 text-[11px] font-semibold text-rose-700 underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: VOUCHERS / REWARDS */}
            {activeTab === "rewards" && (
              <div className="space-y-4">
                {activeRewards.length === 0 ? (
                  <div className="rounded-3xl border border-[#E8DFD1] bg-white p-8 text-center shadow-xs">
                    <div className="text-3xl">🎟️</div>
                    <h4 className="mt-2 text-sm font-serif font-bold text-[#24211E]">
                      No Active Vouchers Yet
                    </h4>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-[#716B64]">
                      You need {stampsRemaining} more stamp{stampsRemaining > 1 ? "s" : ""} to unlock your first dining offer!
                    </p>
                    <button
                      onClick={() => setActiveTab("card")}
                      className="mt-4 rounded-xl py-2 px-4 text-xs font-bold text-white shadow-xs bg-[#B58A4B] hover:bg-[#9E7438]"
                    >
                      View Stamp Progress →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#716B64]">
                      Ready to Redeem ({activeRewards.length})
                    </h4>
                    {activeRewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="rounded-2xl border-2 border-dashed border-[#B58A4B] bg-[#FAF5ED] p-4 shadow-xs"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="inline-block rounded-md bg-[#B58A4B]/20 px-2 py-0.5 text-[10px] font-bold text-[#B58A4B]">
                              VOUCHER
                            </span>
                            <h5 className="mt-1 text-base font-serif font-bold text-[#24211E]">
                              {reward.rewardTitle}
                            </h5>
                            <p className="text-[11px] text-[#716B64]">
                              Valid until {new Date(reward.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-[#B58A4B]">
                              ₹{(reward.discountAmount / 100).toFixed(0)} OFF
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-[#E8DFD1] pt-3">
                          <span className="font-mono text-xs font-bold tracking-wider text-[#24211E]">
                            {reward.code}
                          </span>
                          <button
                            onClick={() =>
                              showRewardQr(reward.code, reward.rewardTitle, reward.discountAmount)
                            }
                            className="rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438] bg-[#B58A4B]"
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
                  <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-xs">
                    <h5 className="text-xs font-bold text-[#24211E]">Past Vouchers</h5>
                    <div className="mt-2 divide-y divide-[#E8DFD1]">
                      {data.customer.rewards
                        .filter((r) => r.status !== "UNREDEEMED")
                        .map((r) => (
                          <div key={r.id} className="flex items-center justify-between py-2 text-xs">
                            <div>
                              <p className="font-semibold text-[#24211E]">{r.rewardTitle}</p>
                              <p className="text-[10px] font-mono text-[#716B64]">{r.code}</p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                r.status === "REDEEMED"
                                  ? "bg-[#FAF5ED] text-[#B58A4B] border border-[#E8DFD1]"
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
              <div className="rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#716B64]">
                  Stamp Activity History
                </h4>

                {data.customer.transactions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#716B64]">
                    No stamp visits recorded on this card yet.
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-[#E8DFD1]">
                    {data.customer.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FAF5ED] text-xs font-bold text-[#B58A4B] border border-[#E8DFD1]">
                            +{tx.amount}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-[#24211E]">
                              {tx.type === "ISSUE" ? "Stamp Awarded" : "Stamp Adjustment"}
                            </p>
                            <p className="text-[10px] text-[#716B64]">
                              {new Date(tx.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {tx.staffNote && (
                          <span className="text-[10px] text-[#716B64] max-w-[120px] truncate">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl border border-[#E8DFD1]">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#FAF5ED] px-2.5 py-0.5 text-xs font-bold text-[#B58A4B] border border-[#E8DFD1]">
                🎁 Redeem at Counter
              </span>
              <button
                onClick={() => setSelectedRewardCode(null)}
                className="text-[#716B64] hover:text-[#24211E] text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <h4 className="mt-3 text-lg font-serif font-bold text-[#24211E]">{selectedRewardTitle}</h4>
            {selectedRewardDiscount > 0 && (
              <p className="text-xs font-bold text-[#B58A4B]">
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
                  className="h-56 w-56 rounded-2xl border border-[#E8DFD1] p-2 shadow-inner"
                />
              ) : (
                <div className="h-56 w-56 rounded-2xl bg-[#FAF5ED] flex items-center justify-center text-xs text-[#716B64]">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#FAF5ED] p-2.5 border border-[#E8DFD1]">
              <span className="text-[10px] font-semibold text-[#716B64] uppercase tracking-wider block">
                Voucher Code
              </span>
              <span className="font-mono text-base font-bold text-[#24211E] tracking-wider">
                {selectedRewardCode}
              </span>
            </div>

            <p className="mt-3 text-[11px] text-[#716B64] leading-tight">
              Show this code to the server or cashier to apply your dining discount.
            </p>

            <button
              onClick={() => setSelectedRewardCode(null)}
              className="mt-4 w-full rounded-xl bg-[#B58A4B] py-2.5 text-xs font-bold text-white transition hover:bg-[#9E7438]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
