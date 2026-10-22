"use client";

import { useState } from "react";
import Link from "next/link";

type Program = {
  id: string;
  title: string;
  isActive: boolean;
  discountType?: string;
  stampsRequired: number;
  minBillAmount: number; // in paise
  rewardTitle: string;
  rewardDiscount: number; // in paise if FLAT, or percentage if PERCENT
  rewardExpiryDays: number;
  terminalPin?: string | null;
};

type Stats = {
  totalCustomers: number;
  totalTransactions: number;
  unredeemedRewards: number;
  redeemedRewards: number;
};

type RecentActivity = {
  id: string;
  stampsCount: number;
  billAmount: number | null;
  billReference: string | null;
  createdAt: string;
  customer: {
    phone: string;
    name: string | null;
    currentStamps: number;
  };
};

export function LoyaltySettingsView({
  initialProgram,
  stats,
  recentActivity,
  qrSlug,
}: {
  initialProgram: Program;
  stats: Stats;
  recentActivity: RecentActivity[];
  qrSlug?: string;
}) {
  const [program, setProgram] = useState(initialProgram);
  const [title, setTitle] = useState(initialProgram.title);
  const [isActive, setIsActive] = useState(initialProgram.isActive);
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">(
    (initialProgram.discountType as "FLAT" | "PERCENT") || "FLAT"
  );
  const [stampsRequired, setStampsRequired] = useState(initialProgram.stampsRequired || 1);
  const [minBillRupees, setMinBillRupees] = useState(initialProgram.minBillAmount / 100);
  
  const initialDiscountVal = initialProgram.discountType === "PERCENT"
    ? initialProgram.rewardDiscount
    : initialProgram.rewardDiscount / 100;
  const [rewardDiscountVal, setRewardDiscountVal] = useState(initialDiscountVal);
  const [rewardTitle, setRewardTitle] = useState(initialProgram.rewardTitle);
  const [rewardExpiryDays, setRewardExpiryDays] = useState(initialProgram.rewardExpiryDays);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dynamic test simulator
  const [testBill, setTestBill] = useState<number>(minBillRupees ? Math.round(minBillRupees * 1.5) : 500);

  // Customer Stamp & Offer Manager state
  const [searchPhone, setSearchPhone] = useState("");
  const [searchedCustomer, setSearchedCustomer] = useState<{
    id: string;
    phone: string | null;
    name: string | null;
    currentStamps: number;
    lifetimeStamps: number;
    rewards?: Array<{ code: string; rewardTitle: string; discountAmount: number; status: string }>;
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [redeemingCode, setRedeemingCode] = useState<string | null>(null);

  // Staff Stamp Tool State (Direct Visit & Anonymous Customer Stamping)
  const [stampCustId, setStampCustId] = useState("");
  const [stampVisitRef, setStampVisitRef] = useState("");
  const [stampStaffNote, setStampStaffNote] = useState("");
  const [stampLoading, setStampLoading] = useState(false);
  const [stampFeedback, setStampFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auto-generate suggested title when numbers change
  function handleAutoSuggestTitle(type: "FLAT" | "PERCENT", disc: number, minBill: number) {
    if (type === "PERCENT") {
      return `${disc}% Off on bills above ₹${minBill}`;
    }
    return `Flat ₹${disc} Off on bills above ₹${minBill}`;
  }

  async function handleAwardAnonStamp(e: React.FormEvent) {
    e.preventDefault();
    if (!stampCustId.trim() || !stampVisitRef.trim()) return;

    setStampLoading(true);
    setStampFeedback(null);
    try {
      const res = await fetch("/api/loyalty/anon/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: stampCustId.trim(),
          visitRef: stampVisitRef.trim(),
          staffNote: stampStaffNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to award stamp");

      setStampFeedback({
        type: "success",
        text: data.message || "1 Stamp awarded successfully!",
      });
      setStampVisitRef("");
      setStampStaffNote("");

      // If customer is currently looked up, sync their state
      if (searchedCustomer && searchedCustomer.id === stampCustId.trim()) {
        setSearchedCustomer((prev) =>
          prev
            ? {
                ...prev,
                currentStamps: data.customer.currentStamps,
                lifetimeStamps: data.customer.lifetimeStamps,
                rewards: data.customer.rewards,
              }
            : null
        );
      }
    } catch (err: any) {
      setStampFeedback({
        type: "error",
        text: err.message || "Failed to award stamp",
      });
    } finally {
      setStampLoading(false);
    }
  }

  async function handleSearchCustomer(e: React.FormEvent) {
    e.preventDefault();
    setSearchLoading(true);
    setSearchMsg(null);
    try {
      const res = await fetch("/api/loyalty/customer/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: searchPhone.trim(), action: "lookup" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      if (!data.found) {
        setSearchedCustomer(null);
        setSearchMsg("No customer record found for this Anonymous ID or number.");
      } else {
        setSearchedCustomer(data.customer);
      }
    } catch (err: any) {
      setSearchMsg(err.message || "Lookup failed");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAdjustCustomer(diff: number) {
    if (!searchedCustomer) return;
    setAdjustLoading(true);
    setSearchMsg(null);
    try {
      const res = await fetch("/api/loyalty/customer/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: searchedCustomer.phone || searchedCustomer.id,
          action: "adjust",
          amount: diff,
          reason: adjustReason || "Owner Manual Adjustment",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Adjustment failed");
      setSearchedCustomer(data.customer);
      setSearchMsg(`✅ ${data.message}`);
      setAdjustReason("");
    } catch (err: any) {
      setSearchMsg(`❌ ${err.message || "Failed to adjust"}`);
    } finally {
      setAdjustLoading(false);
    }
  }

  async function handleGrantOffer() {
    if (!searchedCustomer) return;
    setAdjustLoading(true);
    setSearchMsg(null);
    try {
      const res = await fetch("/api/loyalty/customer/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: searchedCustomer.phone || searchedCustomer.id,
          action: "grant_offer",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to grant offer");
      setSearchMsg(`🎁 ${data.message}`);

      // Refresh customer profile
      const ref = await fetch("/api/loyalty/customer/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: searchedCustomer.phone || searchedCustomer.id, action: "lookup" }),
      });
      const refData = await ref.json();
      if (refData.found) setSearchedCustomer(refData.customer);
    } catch (err: any) {
      setSearchMsg(`❌ ${err.message || "Failed to grant offer"}`);
    } finally {
      setAdjustLoading(false);
    }
  }

  async function handleDirectRedeem(rewardCode: string) {
    setRedeemingCode(rewardCode);
    setSearchMsg(null);
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: program.id,
          rewardCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Redemption failed");
      setSearchMsg(`🎉 Voucher ${rewardCode} redeemed! Discount applied.`);
      // Refresh customer search
      if (searchedCustomer) {
        setSearchedCustomer((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            rewards: prev.rewards?.map((r) =>
              r.code === rewardCode ? { ...r, status: "REDEEMED" } : r
            ),
          };
        });
      }
    } catch (err: any) {
      setSearchMsg(`❌ ${err.message || "Failed to redeem"}`);
    } finally {
      setRedeemingCode(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/loyalty/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          isActive,
          discountType,
          stampsRequired: Number(stampsRequired),
          minBillAmountRupees: Number(minBillRupees),
          rewardTitle,
          rewardDiscountRupees: Number(rewardDiscountVal),
          rewardExpiryDays: Number(rewardExpiryDays),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }

      setProgram(data.program);
      setSuccess("Dynamic offer settings saved! Now live for all customers.");
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  // Simulation calculations
  const simMeetsMin = testBill >= minBillRupees;
  const simDiscount = simMeetsMin
    ? discountType === "PERCENT"
      ? Math.round((testBill * rewardDiscountVal) / 100)
      : Math.min(testBill, rewardDiscountVal)
    : 0;
  const simPayable = Math.max(0, testBill - simDiscount);
  const simEffectivePercent = testBill > 0 ? ((simDiscount / testBill) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 mb-1 border border-emerald-200">
            <span>⚡ Dynamic Offer Engine</span>
            <span className="text-[10px] text-emerald-700 opacity-80">• No Staff Terminal Required</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Dynamic Offers &amp; Rewards
          </h1>
          <p className="mt-0.5 text-sm text-ink/70">
            Decide your offer discount and qualifying bill amount once. It applies dynamically to every customer card.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {qrSlug && (
            <>
              <Link
                href={`/r/${qrSlug}/loyalty`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
              >
                <span>📱 Customer Offer Card ↗</span>
              </Link>

              <Link
                href={`/r/${qrSlug}/home`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink shadow-xs hover:bg-stone-50 transition"
              >
                <span>🌐 Public Review Hub ↗</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Registered Customers</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">{stats.totalCustomers}</p>
          <p className="mt-1 text-[11px] text-ink/50">Diners with active cards</p>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Stamps / Visits Recorded</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">{stats.totalTransactions}</p>
          <p className="mt-1 text-[11px] text-ink/50">Total dining visits tracked</p>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Available Offers</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600">{stats.unredeemedRewards}</p>
          <p className="mt-1 text-[11px] text-ink/50">In customers&apos; digital wallets</p>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Offers Redeemed</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600">{stats.redeemedRewards}</p>
          <p className="mt-1 text-[11px] text-ink/50">Applied at checkout</p>
        </div>
      </div>

      {/* DYNAMIC SETTINGS FORM & LIVE MARGIN SIMULATOR */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSave} className="panel p-5 lg:col-span-2 space-y-5">
          <div className="border-b border-line pb-3">
            <h2 className="font-display text-base font-bold text-ink">Dynamic Offer Rule Configuration</h2>
            <p className="text-xs text-ink/60">
              Set how much discount you offer and on what minimum bill amount. Dynamic calculations occur automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Offer Campaign Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Offer Campaign Status
              </label>
              <select
                value={isActive ? "active" : "paused"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
              >
                <option value="active">Active (Available to all diners)</option>
                <option value="paused">Paused (Temporarily disabled)</option>
              </select>
            </div>

            {/* Offer Discount Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Offer Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => {
                  const newType = e.target.value as "FLAT" | "PERCENT";
                  setDiscountType(newType);
                  const suggested = handleAutoSuggestTitle(newType, rewardDiscountVal, minBillRupees);
                  setRewardTitle(suggested);
                }}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
              >
                <option value="FLAT">Flat ₹ Discount (e.g. ₹100 Off)</option>
                <option value="PERCENT">Percentage % Discount (e.g. 15% Off)</option>
              </select>
            </div>

            {/* On How Much Amount (Min Bill) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                On How Much Amount? (Min. Bill ₹)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm font-bold text-ink/50">₹</span>
                <input
                  type="number"
                  min={1}
                  step={10}
                  value={minBillRupees}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMinBillRupees(val);
                    const suggested = handleAutoSuggestTitle(discountType, rewardDiscountVal, val);
                    setRewardTitle(suggested);
                  }}
                  className="w-full rounded-xl border border-line bg-paper pl-7 pr-3 py-2 text-sm font-semibold text-ink outline-none focus:border-stone-800"
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-ink/50">Diner bill must be at or above this amount.</p>
            </div>

            {/* How Much Offer (Discount Value) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                How Much the Offer? ({discountType === "PERCENT" ? "%" : "₹"})
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm font-bold text-ink/50">
                  {discountType === "PERCENT" ? "%" : "₹"}
                </span>
                <input
                  type="number"
                  min={1}
                  max={discountType === "PERCENT" ? 90 : 10000}
                  step={discountType === "PERCENT" ? 1 : 10}
                  value={rewardDiscountVal}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRewardDiscountVal(val);
                    const suggested = handleAutoSuggestTitle(discountType, val, minBillRupees);
                    setRewardTitle(suggested);
                  }}
                  className="w-full rounded-xl border border-line bg-paper pl-7 pr-3 py-2 text-sm font-semibold text-ink outline-none focus:border-stone-800"
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-ink/50">
                {discountType === "PERCENT" ? "e.g. 15 for 15% discount." : "e.g. 100 for ₹100 discount."}
              </p>
            </div>

            {/* Customer Display Headline */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Voucher Headline Shown to Diner
              </label>
              <input
                type="text"
                value={rewardTitle}
                onChange={(e) => setRewardTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
                required
              />
              <p className="mt-1 text-[11px] text-ink/50">Printed on diner&apos;s digital card.</p>
            </div>

            {/* Validity */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Offer Voucher Validity (Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={rewardExpiryDays}
                onChange={(e) => setRewardExpiryDays(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
                required
              />
              <p className="mt-1 text-[11px] text-ink/50">Days before an unlocked voucher expires.</p>
            </div>

            {/* Visits Required */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Visits to Unlock
              </label>
              <select
                value={stampsRequired}
                onChange={(e) => setStampsRequired(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
              >
                <option value={1}>1 Visit (Instant Offer for Every Diner / Reviewer)</option>
                <option value={3}>3 Visits (Frequent Diner Tier)</option>
                <option value={5}>5 Visits (Regulars Tier)</option>
                <option value={10}>10 Visits (VIP Stamp Collector)</option>
              </select>
              <p className="mt-1 text-[11px] text-ink/50">Select 1 for instant voucher on scanning QR.</p>
            </div>
          </div>

          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              {success}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-stone-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-stone-800 disabled:opacity-60 transition"
            >
              {saving ? "Saving Changes..." : "Save Dynamic Offer Rule"}
            </button>
          </div>
        </form>

        {/* DYNAMIC LIVE SIMULATOR & REVENUE IMPACT PANEL */}
        <div className="panel p-5 space-y-4">
          <div className="border-b border-line pb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🧮</span>
              <h2 className="font-display text-base font-bold text-ink">Live Offer Calculator</h2>
            </div>
            <p className="text-xs text-ink/60">Simulate any diner bill amount in real time.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink/60">
                Test Sample Diner Bill (₹)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm font-bold text-ink/50">₹</span>
                <input
                  type="number"
                  min={10}
                  step={50}
                  value={testBill}
                  onChange={(e) => setTestBill(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-paper pl-7 pr-3 py-2 text-sm font-bold text-ink outline-none focus:border-stone-800"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-stone-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink/60">Qualifying Minimum:</span>
                <strong className="font-bold text-ink">₹{minBillRupees}</strong>
              </div>

              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink/60">Offer Status:</span>
                <strong className={simMeetsMin ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                  {simMeetsMin ? "✅ Qualified for Offer" : `❌ Under Minimum (Add ₹${minBillRupees - testBill})`}
                </strong>
              </div>

              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink/60">Customer Saves:</span>
                <strong className="font-bold text-emerald-700">₹{simDiscount}</strong>
              </div>

              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink/60">Net Customer Pays:</span>
                <strong className="font-extrabold text-stone-900 text-sm">₹{simPayable}</strong>
              </div>

              <div className="flex justify-between pt-0.5">
                <span className="text-ink/60">Effective Discount %:</span>
                <strong className="font-bold text-ink">{simEffectivePercent}%</strong>
              </div>
            </div>

            {/* Diner Card Preview */}
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/60 p-3.5 text-center space-y-1">
              <div className="text-[10px] uppercase font-bold text-amber-800">Diner Voucher Preview</div>
              <div className="text-sm font-extrabold text-stone-900">{rewardTitle}</div>
              <div className="text-[11px] text-stone-600">
                Valid on bills of <strong>₹{minBillRupees}+</strong> • Instant counter discount
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STAFF STAMP TOOL (ANONYMOUS & DINER QR FLOW) */}
      <div className="panel p-5 space-y-4 border-2 border-stone-800/10">
        <div className="border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h2 className="font-display text-base font-bold text-ink">
              Staff Stamp Issuance Tool
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Staff Authorized
            </span>
          </div>
          <p className="text-xs text-ink/60">
            Award loyalty stamps to diners by reading their Anonymous Customer ID (from screen or QR) and entering the invoice/visit reference.
          </p>
        </div>

        <form onSubmit={handleAwardAnonStamp} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink/70 mb-1">
                Customer Reference ID *
              </label>
              <input
                type="text"
                placeholder="e.g. anon_k8jF3m9PqR..."
                value={stampCustId}
                onChange={(e) => setStampCustId(e.target.value)}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs font-mono font-medium text-ink outline-none focus:border-stone-800"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink/70 mb-1">
                Unique Bill / Visit Ref *
              </label>
              <input
                type="text"
                placeholder="e.g. INV-1042 / Table-4-Visit"
                value={stampVisitRef}
                onChange={(e) => setStampVisitRef(e.target.value)}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs font-mono font-medium text-ink outline-none focus:border-stone-800"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink/70 mb-1">
              Staff Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Counter Order #23, Table 6"
              value={stampStaffNote}
              onChange={(e) => setStampStaffNote(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs font-medium text-ink outline-none focus:border-stone-800"
            />
          </div>

          {stampFeedback && (
            <div
              className={`rounded-xl border p-3 text-xs font-semibold ${
                stampFeedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {stampFeedback.text}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={stampLoading}
              className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60 transition"
            >
              {stampLoading ? "Verifying & Awarding..." : "⚡ Issue 1 Stamp to Customer"}
            </button>
          </div>
        </form>
      </div>

      {/* CUSTOMER STAMP & OFFER MANAGER (LOOKUP & 1-TAP REDEEM) */}
      <div className="panel p-5 space-y-4">
        <div className="border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <h2 className="font-display text-base font-bold text-ink">
              Customer &amp; Offer Voucher Manager
            </h2>
          </div>
          <p className="text-xs text-ink/60">
            Look up any customer by Anonymous Customer ID or mobile number to inspect active vouchers, redeem at counter, or adjust stamps.
          </p>
        </div>

        <form onSubmit={handleSearchCustomer} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search Anonymous Customer ID (anon_...) or 10-digit mobile"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-xs font-medium text-ink outline-none focus:border-stone-800 font-mono"
              required
            />
          </div>
          <button
            type="submit"
            disabled={searchLoading}
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-stone-800 disabled:opacity-60 transition"
          >
            {searchLoading ? "Searching..." : "Find Customer"}
          </button>
        </form>

        {searchMsg && (
          <div className="rounded-xl border border-line bg-stone-50 p-3 text-xs font-medium text-stone-700">
            {searchMsg}
          </div>
        )}

        {searchedCustomer && (
          <div className="rounded-2xl border border-line bg-white p-4 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-ink">
                    {searchedCustomer.phone
                      ? `+91 ${searchedCustomer.phone}`
                      : `Anonymous Customer (${searchedCustomer.id.slice(0, 12)}…)`}
                    {searchedCustomer.name && (
                      <span className="ml-2 font-normal text-xs text-ink/60">
                        ({searchedCustomer.name})
                      </span>
                    )}
                  </p>
                  {!searchedCustomer.phone && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      🔒 Cookie Identity
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink/50 mt-0.5">
                  ID: <span className="font-mono">{searchedCustomer.id}</span> • Lifetime Visits Tracked: {searchedCustomer.lifetimeStamps}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStampCustId(searchedCustomer.id);
                    setStampFeedback(null);
                    window.scrollTo({ top: 400, behavior: "smooth" });
                  }}
                  className="rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700 hover:bg-stone-200 transition"
                >
                  ⚡ Award Stamp
                </button>
                <span className="rounded-lg bg-emerald-50 px-3 py-1 font-mono text-sm font-bold text-emerald-800 border border-emerald-200">
                  ☕ {searchedCustomer.currentStamps} / {stampsRequired} Stamps
                </span>
              </div>
            </div>

            {/* Active Unlocked Rewards for this customer */}
            {searchedCustomer.rewards && searchedCustomer.rewards.length > 0 && (
              <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Customer Rewards &amp; Vouchers:
                </p>
                <div className="space-y-2">
                  {searchedCustomer.rewards.map((r) => (
                    <div
                      key={r.code}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-white p-3 border border-amber-100"
                    >
                      <div>
                        <div className="text-xs font-bold text-stone-900">
                          {r.rewardTitle}
                        </div>
                        <div className="font-mono text-xs text-stone-500 font-semibold">
                          Code: {r.code}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            r.status === "UNREDEEMED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {r.status}
                        </span>

                        {r.status === "UNREDEEMED" && (
                          <button
                            type="button"
                            disabled={redeemingCode === r.code}
                            onClick={() => handleDirectRedeem(r.code)}
                            className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
                          >
                            {redeemingCode === r.code ? "Redeeming..." : "Redeem Now"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Adjustment Controls */}
            <div className="pt-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">
                Reason / Note for Adjustment (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Special goodwill adjustment, offline bill compensation"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink outline-none focus:border-stone-800 mb-3"
              />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink/60 mr-1">Quick Action:</span>
                <button
                  type="button"
                  disabled={adjustLoading}
                  onClick={() => handleAdjustCustomer(1)}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition disabled:opacity-60"
                >
                  +1 Stamp
                </button>
                <button
                  type="button"
                  disabled={adjustLoading}
                  onClick={() => handleAdjustCustomer(2)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                >
                  +2 Stamps
                </button>
                <button
                  type="button"
                  disabled={adjustLoading}
                  onClick={handleGrantOffer}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition disabled:opacity-60"
                >
                  🎁 Issue Offer Voucher
                </button>
                <button
                  type="button"
                  disabled={adjustLoading || searchedCustomer.currentStamps <= 0}
                  onClick={() => handleAdjustCustomer(-1)}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                >
                  -1 Stamp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RECENT STAMP & OFFER TRANSACTIONS TABLE */}
      <div className="panel p-5">
        <div className="border-b border-line pb-3">
          <h2 className="font-display text-base font-bold text-ink">Recent Offer &amp; Visit Activity</h2>
          <p className="text-xs text-ink/60">Live ledger of dining visits and rewards recorded.</p>
        </div>

        {recentActivity.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink/50">
            No transactions recorded yet. When diners scan your QR and avail offers, activity will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-ink/50 font-bold uppercase text-[10px]">
                  <th className="py-2">Customer</th>
                  <th className="py-2">Activity</th>
                  <th className="py-2">Bill Amount</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {recentActivity.map((tx) => (
                  <tr key={tx.id} className="hover:bg-paper/50 transition">
                    <td className="py-2.5 font-medium text-ink">
                      <div>+91 {tx.customer.phone}</div>
                      {tx.customer.name && (
                        <div className="text-[10px] text-ink/50">{tx.customer.name}</div>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200/60">
                        ☕ +{tx.stampsCount} Visit
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-ink">
                      {tx.billAmount ? `₹${(tx.billAmount / 100).toFixed(0)}` : "—"}
                    </td>
                    <td className="py-2.5 text-ink/60 font-mono text-[11px]">
                      {tx.billReference || "—"}
                    </td>
                    <td className="py-2.5 text-right text-ink/50">
                      {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
