"use client";

import { useState } from "react";
import Link from "next/link";
import { OwnerStampRequestsPanel } from "./OwnerStampRequestsPanel";

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
  reviewClicks?: number;
};

type RecentCustomer = {
  id: string;
  name: string;
  phone: string;
  visits: number;
  stamps: number;
  lastVisit: string;
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
  recentCustomers = [],
  recentActivity = [],
  qrSlug,
}: {
  initialProgram: Program;
  stats: Stats;
  recentCustomers?: RecentCustomer[];
  recentActivity?: RecentActivity[];
  qrSlug?: string;
}) {
  const [program, setProgram] = useState(initialProgram);
  const [title, setTitle] = useState(initialProgram.title || "The Daily Brew Rewards");
  const [isActive, setIsActive] = useState(initialProgram.isActive);
  const [discountType, setDiscountType] = useState<"PERCENT" | "FLAT" | "FREE_ITEM">(
    (initialProgram.discountType as "PERCENT" | "FLAT" | "FREE_ITEM") || "PERCENT"
  );
  const [stampsRequired, setStampsRequired] = useState(initialProgram.stampsRequired || 5);
  const [minBillRupees, setMinBillRupees] = useState(initialProgram.minBillAmount ? initialProgram.minBillAmount / 100 : 0);

  const initialDiscountVal =
    initialProgram.discountType === "PERCENT"
      ? initialProgram.rewardDiscount || 30
      : initialProgram.discountType === "FREE_ITEM"
      ? 0
      : initialProgram.rewardDiscount ? initialProgram.rewardDiscount / 100 : 100;

  const [rewardDiscountVal, setRewardDiscountVal] = useState(initialDiscountVal);
  const [rewardTitle, setRewardTitle] = useState(initialProgram.rewardTitle || "30% OFF on your next visit");
  const [rewardExpiryDays, setRewardExpiryDays] = useState(initialProgram.rewardExpiryDays || 30);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Staff Stamp Issuance Tool State
  const [stampCustomerRef, setStampCustomerRef] = useState("");
  const [stampVisitRef, setStampVisitRef] = useState("");
  const [stampNote, setStampNote] = useState("");
  const [stampLoading, setStampLoading] = useState(false);
  const [stampFeedback, setStampFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Staff Direct Voucher Redeem Tool State
  const [redeemVoucherCode, setRedeemVoucherCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-suggest Reward Title based on settings
  function handleTypeChange(newType: "PERCENT" | "FLAT" | "FREE_ITEM") {
    setDiscountType(newType);
    if (newType === "PERCENT") {
      setRewardDiscountVal(30);
      setRewardTitle("30% OFF on your next visit");
    } else if (newType === "FLAT") {
      setRewardDiscountVal(100);
      setRewardTitle("Flat ₹100 OFF on your next visit");
    } else {
      setRewardDiscountVal(0);
      setRewardTitle("Free Special Item with Meal");
    }
  }

  // Save Loyalty Program Settings (Section 4 in Mockup)
  async function handleSaveProgram(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/loyalty/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          isActive,
          discountType,
          stampsRequired: Number(stampsRequired),
          minBillAmountRupees: Number(minBillRupees),
          rewardTitle: rewardTitle.trim(),
          rewardDiscountRupees: Number(rewardDiscountVal),
          rewardExpiryDays: Number(rewardExpiryDays),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update program");

      setProgram(data.program);
      setSaveSuccess("Program settings saved successfully!");
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  // Issue Stamp to Customer (Section 6 in Customer Journey)
  async function handleIssueStamp(e: React.FormEvent) {
    e.preventDefault();
    if (!stampCustomerRef.trim() || !stampVisitRef.trim()) return;

    setStampLoading(true);
    setStampFeedback(null);
    try {
      const isAnon = stampCustomerRef.startsWith("anon_");
      const url = isAnon ? "/api/loyalty/anon/stamp" : "/api/loyalty/stamp";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: isAnon ? stampCustomerRef.trim() : undefined,
          phone: !isAnon ? stampCustomerRef.trim() : undefined,
          visitRef: stampVisitRef.trim(),
          billReference: stampVisitRef.trim(),
          staffNote: stampNote.trim() || "Counter Staff Stamp",
          billAmountRupees: Math.max(1, minBillRupees || 100),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue stamp");

      setStampFeedback({
        type: "success",
        message: data.message || "1 Stamp awarded successfully!",
      });
      setStampVisitRef("");
      setStampNote("");
    } catch (err: any) {
      setStampFeedback({
        type: "error",
        message: err.message || "Failed to award stamp",
      });
    } finally {
      setStampLoading(false);
    }
  }

  // Redeem Voucher Code (Reward Redemption Screen in Mockup)
  async function handleRedeemVoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!redeemVoucherCode.trim()) return;

    setRedeemLoading(true);
    setRedeemFeedback(null);
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardCode: redeemVoucherCode.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to redeem voucher");

      setRedeemFeedback({
        type: "success",
        message: data.message || `Voucher ${redeemVoucherCode} redeemed successfully!`,
      });
      setRedeemVoucherCode("");
    } catch (err: any) {
      setRedeemFeedback({
        type: "error",
        message: err.message || "Failed to redeem voucher",
      });
    } finally {
      setRedeemLoading(false);
    }
  }

  // Fallback demo recent customers if database is fresh
  const displayCustomers: RecentCustomer[] =
    recentCustomers.length > 0
      ? recentCustomers
      : [
          { id: "1", name: "Aarav Sharma", phone: "98765 43210", visits: 8, stamps: 4, lastVisit: "Today" },
          { id: "2", name: "Riya Mehta", phone: "91234 56789", visits: 5, stamps: 5, lastVisit: "2 days ago" },
          { id: "3", name: "Karan Patel", phone: "99887 66554", visits: 3, stamps: 3, lastVisit: "3 days ago" },
          { id: "4", name: "Ananya Iyer", phone: "98112 33445", visits: 2, stamps: 2, lastVisit: "5 days ago" },
        ];

  // Fallback demo recent activities if list is fresh
  const displayActivity =
    recentActivity.length > 0
      ? recentActivity
      : [
          {
            id: "act-1",
            stampsCount: 1,
            billAmount: 45000,
            billReference: "INV-1024",
            createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
            customer: { phone: "9876543210", name: "Aarav Sharma", currentStamps: 4 },
          },
          {
            id: "act-2",
            stampsCount: 0,
            billAmount: 62000,
            billReference: "OFFER-30%",
            createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
            customer: { phone: "9123456789", name: "Riya Mehta", currentStamps: 5 },
          },
          {
            id: "act-3",
            stampsCount: 1,
            billAmount: 38000,
            billReference: "INV-1022",
            createdAt: new Date(Date.now() - 240 * 60000).toISOString(),
            customer: { phone: "9988766554", name: "Karan Patel", currentStamps: 3 },
          },
        ];

  // Dynamic values or mock stats from the diagram
  const totalMembersVal = stats.totalCustomers > 0 ? stats.totalCustomers.toLocaleString() : "1,240";
  const stampsIssuedVal = stats.totalTransactions > 0 ? stats.totalTransactions.toLocaleString() : "3,680";
  const rewardsRedeemedVal = stats.redeemedRewards > 0 ? stats.redeemedRewards.toLocaleString() : "186";
  const reviewClicksVal = stats.reviewClicks && stats.reviewClicks > 0 ? stats.reviewClicks.toLocaleString() : "324";

  return (
    <div className="space-y-8 font-sans pb-16">
      {/* ─────────────────────────────────────────────────────────────
          TOP BAR: TITLE & LIVE RESTAURANT LINK
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Dashboard</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Active Program
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage your program, track growth and understand your customers.
          </p>
        </div>

        {qrSlug && (
          <div className="flex items-center gap-2">
            <Link
              href={`/r/${qrSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 transition"
            >
              <span>📱 View Customer QR Experience</span>
              <span className="text-[10px] text-stone-400">↗</span>
            </Link>
          </div>
        )}
      </div>

      {/* Real-time Customer Visit Stamp Requests Panel */}
      <OwnerStampRequestsPanel restaurantBrandColor="#1F6F5C" />

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: 4 TOP KPI METRIC CARDS (Exact match to mockup)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* KPI 1: Loyalty Members */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xl">👥</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              +12%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-stone-900">{totalMembersVal}</div>
            <div className="text-xs font-semibold text-stone-500 mt-0.5">Loyalty Members</div>
          </div>
        </div>

        {/* KPI 2: Stamps Issued */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xl">☕</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              +18%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-stone-900">{stampsIssuedVal}</div>
            <div className="text-xs font-semibold text-stone-500 mt-0.5">Stamps Issued</div>
          </div>
        </div>

        {/* KPI 3: Rewards Redeemed */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xl">🎁</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              +22%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-stone-900">{rewardsRedeemedVal}</div>
            <div className="text-xs font-semibold text-stone-500 mt-0.5">Rewards Redeemed</div>
          </div>
        </div>

        {/* KPI 4: Review Clicks */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xl">📊</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              +45%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-stone-900">{reviewClicksVal}</div>
            <div className="text-xs font-semibold text-stone-500 mt-0.5">Review Clicks</div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VISUAL CHARTS ROW: Customer Growth & Reward Redemptions Donut
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Customer Growth Spline Chart */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Customer Growth</h3>
              <p className="text-[11px] text-stone-400">Total new registered loyalty members over time</p>
            </div>
            <span className="text-xs font-semibold text-stone-500">Last 6 Months</span>
          </div>

          <div className="mt-4">
            {/* SVG Trend Spline */}
            <div className="relative h-44 w-full">
              <svg viewBox="0 0 500 160" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D97706" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Guide Lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="#F3F4F6" strokeDasharray="4 4" />
                <line x1="0" y1="70" x2="500" y2="70" stroke="#F3F4F6" strokeDasharray="4 4" />
                <line x1="0" y1="110" x2="500" y2="110" stroke="#F3F4F6" strokeDasharray="4 4" />

                {/* Area Fill */}
                <path
                  d="M 10 140 Q 90 120 170 95 T 330 60 T 490 25 L 490 150 L 10 150 Z"
                  fill="url(#growthGrad)"
                />
                {/* Line Spline */}
                <path
                  d="M 10 140 Q 90 120 170 95 T 330 60 T 490 25"
                  fill="none"
                  stroke="#B45309"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Data Points */}
                <circle cx="10" cy="140" r="4" fill="#B45309" />
                <circle cx="90" cy="120" r="4" fill="#B45309" />
                <circle cx="170" cy="95" r="4" fill="#B45309" />
                <circle cx="250" cy="78" r="4" fill="#B45309" />
                <circle cx="330" cy="60" r="4" fill="#B45309" />
                <circle cx="410" cy="42" r="4" fill="#B45309" />
                <circle cx="490" cy="25" r="5" fill="#B45309" stroke="#FFFFFF" strokeWidth="2" />
              </svg>

              <div className="mt-2 flex justify-between text-[10px] font-semibold text-stone-400">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reward Redemptions Donut Breakdown */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold text-stone-900">Reward Redemptions</h3>
            <p className="text-[11px] text-stone-400">Claimed vs Pending Vouchers</p>
          </div>

          <div className="my-auto py-4 flex flex-col items-center">
            {/* Visual Donut Ring */}
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#B45309"
                  strokeWidth="3.5"
                  strokeDasharray="72 28"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-black text-stone-900">{rewardsRedeemedVal}</span>
                <span className="block text-[9px] font-bold text-stone-400 uppercase">Redeemed</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-700" />
                <span className="font-semibold text-stone-700">Redeemed (72%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                <span className="font-semibold text-stone-500">Pending (28%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TABLES ROW: Recent Customers & Recent Activity Feed
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Customers Table */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Recent Customers</h3>
              <p className="text-[11px] text-stone-400">Diners registered through the QR welcome flow</p>
            </div>
            <span className="text-xs font-semibold text-stone-500">
              Total {displayCustomers.length} Listed
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200/80 text-[11px] font-bold text-stone-400 uppercase">
                  <th className="py-2.5">Name</th>
                  <th className="py-2.5">Phone</th>
                  <th className="py-2.5 text-center">Visits</th>
                  <th className="py-2.5 text-center">Stamps</th>
                  <th className="py-2.5 text-right">Last Visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/60 transition">
                    <td className="py-3 font-semibold text-stone-900 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-900">
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>{c.name}</span>
                    </td>
                    <td className="py-3 font-mono text-stone-600">{c.phone}</td>
                    <td className="py-3 text-center font-bold text-stone-800">{c.visits}</td>
                    <td className="py-3 text-center">
                      <span className="inline-block rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 font-bold text-amber-900">
                        ☕ {c.stamps}/{stampsRequired}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium text-stone-500">{c.lastVisit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Timeline Feed */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold text-stone-900">Recent Activity</h3>
            <p className="text-[11px] text-stone-400">Live timeline of stamps &amp; offers</p>
          </div>

          <div className="mt-4 space-y-3.5 max-h-72 overflow-y-auto pr-1">
            {displayActivity.map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm">
                  {act.stampsCount > 0 ? "☕" : "🎁"}
                </span>
                <div className="flex-1 leading-tight">
                  <p className="font-bold text-stone-800">
                    {act.customer.name || act.customer.phone}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {act.stampsCount > 0
                      ? `Earned a stamp (${act.billReference || "visit"})`
                      : "Redeemed reward voucher"}
                  </p>
                  <span className="text-[10px] text-stone-400">
                    {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          COUNTER TOOLS: Staff Stamp Issuance & 1-Click Voucher Redeem
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Tool 1: Staff Stamp Tool */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h3 className="text-sm font-bold text-stone-900">Staff Stamp Tool</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                Staff Counter
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Verify customer visit and award a loyalty stamp on qualifying bill.
            </p>
          </div>

          <form onSubmit={handleIssueStamp} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Customer Mobile / ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210 or anon_..."
                  value={stampCustomerRef}
                  onChange={(e) => setStampCustomerRef(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-stone-800 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Invoice / Bill Ref *
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-1042"
                  value={stampVisitRef}
                  onChange={(e) => setStampVisitRef(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-stone-800 focus:bg-white"
                  required
                />
              </div>
            </div>

            {stampFeedback && (
              <div
                className={`rounded-xl border p-2.5 text-xs font-semibold ${
                  stampFeedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {stampFeedback.message}
              </div>
            )}

            <button
              type="submit"
              disabled={stampLoading}
              className="rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-stone-800 transition disabled:opacity-60"
            >
              {stampLoading ? "Recording Visit..." : "⚡ Award 1 Stamp"}
            </button>
          </form>
        </div>

        {/* Tool 2: Staff Voucher Redemption Tool */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎟️</span>
              <h3 className="text-sm font-bold text-stone-900">Voucher Redemption Tool</h3>
            </div>
            <p className="text-xs text-stone-500">
              Enter customer&apos;s voucher code or scan QR to mark reward as redeemed.
            </p>
          </div>

          <form onSubmit={handleRedeemVoucher} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Voucher Code *
              </label>
              <input
                type="text"
                placeholder="e.g. OFFER-1234X / DBR-7F3K"
                value={redeemVoucherCode}
                onChange={(e) => setRedeemVoucherCode(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-mono font-bold text-stone-900 outline-none focus:border-stone-800 focus:bg-white uppercase"
                required
              />
            </div>

            {redeemFeedback && (
              <div
                className={`rounded-xl border p-2.5 text-xs font-semibold ${
                  redeemFeedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {redeemFeedback.message}
              </div>
            )}

            <button
              type="submit"
              disabled={redeemLoading}
              className="rounded-xl bg-amber-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-800 transition disabled:opacity-60"
            >
              {redeemLoading ? "Redeeming..." : "Redeem Voucher Discount"}
            </button>
          </form>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: LOYALTY PROGRAM SETTINGS (Exact match to mockup)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-sm">
        <div className="border-b border-stone-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900">Create / Edit Program</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Fully customizable for your restaurant.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-stone-700">Program Active</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded text-amber-600 focus:ring-0"
              />
            </label>
          </div>
        </div>

        <form onSubmit={handleSaveProgram} className="mt-6 space-y-5">
          {/* Field 1: Program Name */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Program Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Daily Brew Rewards"
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-900 outline-none focus:border-stone-800 shadow-2xs"
              required
            />
          </div>

          {/* Field 2: Stamps Required (Slider + Number) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700">
                Stamps Required
              </label>
              <span className="rounded-lg bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">
                ☕ {stampsRequired} Stamps
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              value={stampsRequired}
              onChange={(e) => setStampsRequired(Number(e.target.value))}
              className="w-full accent-amber-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>1 stamp (instant)</span>
              <span>5 stamps (recommended)</span>
              <span>15 stamps</span>
            </div>
          </div>

          {/* Field 3: Reward Type (Radio Buttons from Mockup) */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">
              Reward Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Radio 1: Percentage Discount */}
              <label
                onClick={() => handleTypeChange("PERCENT")}
                className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  discountType === "PERCENT"
                    ? "border-amber-600 bg-amber-50/50 shadow-2xs"
                    : "border-stone-200 bg-stone-50/50 hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "PERCENT"}
                  onChange={() => handleTypeChange("PERCENT")}
                  className="accent-amber-700"
                />
                <span className="text-xs font-semibold text-stone-800">Percentage Discount (%)</span>
              </label>

              {/* Radio 2: Fixed Discount */}
              <label
                onClick={() => handleTypeChange("FLAT")}
                className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  discountType === "FLAT"
                    ? "border-amber-600 bg-amber-50/50 shadow-2xs"
                    : "border-stone-200 bg-stone-50/50 hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "FLAT"}
                  onChange={() => handleTypeChange("FLAT")}
                  className="accent-amber-700"
                />
                <span className="text-xs font-semibold text-stone-800">Fixed Discount (₹)</span>
              </label>

              {/* Radio 3: Free Item */}
              <label
                onClick={() => handleTypeChange("FREE_ITEM")}
                className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  discountType === "FREE_ITEM"
                    ? "border-amber-600 bg-amber-50/50 shadow-2xs"
                    : "border-stone-200 bg-stone-50/50 hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "FREE_ITEM"}
                  onChange={() => handleTypeChange("FREE_ITEM")}
                  className="accent-amber-700"
                />
                <span className="text-xs font-semibold text-stone-800">Free Item 🥐</span>
              </label>
            </div>
          </div>

          {/* Fields 4, 5, 6: Discount Value, Validity, Minimum Spend */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Discount Value {discountType === "PERCENT" ? "(%)" : discountType === "FLAT" ? "(₹)" : ""}
              </label>
              <input
                type="number"
                min={0}
                max={discountType === "PERCENT" ? 100 : 50000}
                value={rewardDiscountVal}
                onChange={(e) => setRewardDiscountVal(Number(e.target.value))}
                className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-900 outline-none focus:border-stone-800 shadow-2xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Reward Validity (Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={rewardExpiryDays}
                onChange={(e) => setRewardExpiryDays(Number(e.target.value))}
                className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-900 outline-none focus:border-stone-800 shadow-2xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Minimum Spend (Optional) (₹)
              </label>
              <input
                type="number"
                min={0}
                value={minBillRupees}
                onChange={(e) => setMinBillRupees(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-900 outline-none focus:border-stone-800 shadow-2xs"
              />
            </div>
          </div>

          {/* Reward Display Title */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Reward Headline shown to Diners
            </label>
            <input
              type="text"
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
              placeholder="e.g. 30% OFF on your next visit"
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-900 outline-none focus:border-stone-800 shadow-2xs"
              required
            />
          </div>

          {saveSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              ✅ {saveSuccess}
            </div>
          )}

          {saveError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              ❌ {saveError}
            </div>
          )}

          {/* Button: Save Program */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl px-7 py-3 text-xs font-bold text-white shadow-md hover:brightness-105 active:scale-[0.98] transition disabled:opacity-60"
              style={{ backgroundColor: "#8C5A2B" }}
            >
              {saving ? "Saving Program..." : "Save Program"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
