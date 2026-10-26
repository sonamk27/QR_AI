"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { OwnerStampRequestsPanel } from "./OwnerStampRequestsPanel";

export type DailyGrowthPoint = {
  date: string;
  day: string;
  shortDate: string;
  label: string;
  count: number;
  phoneCount: number;
  anonCount: number;
};

export type MonthlyGrowthPoint = {
  month: string;
  label: string;
  fullMonth: string;
  year: number;
  count: number;
  phoneCount: number;
  anonCount: number;
};

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
  pendingStampRequests?: number;
  reviewClicks?: number;
};

type ActiveRewardSummary = {
  id: string;
  code: string;
  rewardTitle: string;
  expiresAt: string | Date;
};

type RecentCustomer = {
  id: string;
  name: string;
  phone: string;
  visits: number;
  stamps: number;
  lastVisit: string;
  activeRewards?: ActiveRewardSummary[];
};

type LiveActivityItem = {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  stampsCount?: number;
  billAmount?: number | null;
  billReference?: string | null;
  createdAt: string;
  customer?: {
    phone: string;
    name: string | null;
    currentStamps?: number;
  };
  customerName?: string;
  customerPhone?: string;
  icon?: string;
  badge?: string;
  badgeColor?: "amber" | "emerald" | "rose" | "blue" | "purple";
  tableNo?: string | null;
  code?: string | null;
};

export function LoyaltySettingsView({
  initialProgram,
  stats,
  recentCustomers = [],
  recentActivity = [],
  initialDailyGrowth = [],
  initialMonthlyGrowth = [],
  qrSlug,
}: {
  initialProgram: Program;
  stats: Stats;
  recentCustomers?: RecentCustomer[];
  recentActivity?: LiveActivityItem[] | any[];
  initialDailyGrowth?: DailyGrowthPoint[];
  initialMonthlyGrowth?: MonthlyGrowthPoint[];
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

  // Real-time Live State synchronized directly with backend
  const [liveStats, setLiveStats] = useState<Stats>(stats);
  const [liveCustomers, setLiveCustomers] = useState<RecentCustomer[]>(recentCustomers);
  const [liveActivity, setLiveActivity] = useState<LiveActivityItem[]>(recentActivity as any);

  // Customer Growth state: Day-wise and Month-wise options
  const [growthView, setGrowthView] = useState<"DAY" | "MONTH">("DAY");
  const [dayRange, setDayRange] = useState<number>(30);
  const [monthRange, setMonthRange] = useState<6 | 12>(6);
  const [channelFilter, setChannelFilter] = useState<"ALL" | "PHONE" | "ANON">("ALL");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const [dailyGrowth, setDailyGrowth] = useState<DailyGrowthPoint[]>(initialDailyGrowth);
  const [monthlyGrowth, setMonthlyGrowth] = useState<MonthlyGrowthPoint[]>(initialMonthlyGrowth);

  const [quickStampLoadingPhone, setQuickStampLoadingPhone] = useState<string | null>(null);
  const [quickStampFeedback, setQuickStampFeedback] = useState<{ phone: string; message: string; type: "success" | "error" } | null>(null);

  async function refreshDashboardData() {
    try {
      const res = await fetch("/api/loyalty/dashboard-data");
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.stats) setLiveStats(data.stats);
        if (data.customers) setLiveCustomers(data.customers);
        if (data.recentActivity) setLiveActivity(data.recentActivity);
        if (data.dailyGrowth) setDailyGrowth(data.dailyGrowth);
        if (data.monthlyGrowth) setMonthlyGrowth(data.monthlyGrowth);
        if (data.program) setProgram((prev) => ({ ...prev, ...data.program }));
      }
    } catch (err) {
      console.error("Dashboard refresh failed:", err);
    }
  }

  // Live auto-refresh polling every 4 seconds
  useEffect(() => {
    refreshDashboardData();
    const interval = setInterval(refreshDashboardData, 4000);
    return () => clearInterval(interval);
  }, []);

  function handleTypeChange(newType: "PERCENT" | "FLAT" | "FREE_ITEM") {
    setDiscountType(newType);
    if (newType === "PERCENT") {
      setRewardDiscountVal(30);
      setRewardTitle("30% OFF on your next visit");
    } else if (newType === "FLAT") {
      setRewardDiscountVal(100);
      setRewardTitle("₹100 OFF on your next visit");
    } else {
      setRewardDiscountVal(0);
      setRewardTitle("Free Special Item on your next visit");
    }
  }

  async function handleSaveProgram(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const rewardDiscountRupees =
      discountType === "PERCENT"
        ? Math.min(100, Math.max(1, rewardDiscountVal))
        : discountType === "FREE_ITEM"
        ? 0
        : rewardDiscountVal;

    try {
      const res = await fetch("/api/loyalty/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          isActive,
          discountType,
          stampsRequired,
          minBillAmountRupees: minBillRupees,
          rewardTitle,
          rewardDiscountRupees,
          rewardExpiryDays,
          terminalPin: program.terminalPin || "1234",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save program settings");

      setSaveSuccess("Program settings updated successfully!");
      setProgram(data.program);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStamp(phone: string, customerName?: string) {
    setQuickStampLoadingPhone(phone);
    setQuickStampFeedback(null);
    try {
      const res = await fetch("/api/loyalty/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone: phone,
          billReference: "Dashboard Quick Stamp",
          staffNote: "Direct staff 1-click stamp",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to award stamp");

      setQuickStampFeedback({
        phone,
        type: "success",
        message: data.message || `1 Stamp awarded to ${customerName || phone}!`,
      });
      await refreshDashboardData();
    } catch (err: any) {
      setQuickStampFeedback({
        phone,
        type: "error",
        message: err.message || "Failed to award stamp",
      });
    } finally {
      setQuickStampLoadingPhone(null);
      setTimeout(() => setQuickStampFeedback(null), 4000);
    }
  }

  async function handleIssueStamp(e: React.FormEvent) {
    e.preventDefault();
    if (!stampCustomerRef.trim()) return;

    setStampLoading(true);
    setStampFeedback(null);
    try {
      const isAnon = stampCustomerRef.trim().startsWith("anon_");
      const endpoint = isAnon ? "/api/loyalty/anon/stamp" : "/api/loyalty/stamp";
      const payload = isAnon
        ? {
            customerId: stampCustomerRef.trim(),
            verificationRef: stampVisitRef.trim() || "Manual Counter Verification",
            amount: 1,
            staffNote: stampNote.trim() || undefined,
          }
        : {
            customerPhone: stampCustomerRef.trim(),
            billReference: stampVisitRef.trim(),
            staffNote: stampNote.trim() || undefined,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue stamp");

      setStampFeedback({
        type: "success",
        message: data.message || "1 Stamp awarded successfully!",
      });
      setStampVisitRef("");
      setStampNote("");
      await refreshDashboardData();
    } catch (err: any) {
      setStampFeedback({
        type: "error",
        message: err.message || "Failed to award stamp",
      });
    } finally {
      setStampLoading(false);
    }
  }

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
      await refreshDashboardData();
    } catch (err: any) {
      setRedeemFeedback({
        type: "error",
        message: err.message || "Failed to redeem voucher",
      });
    } finally {
      setRedeemLoading(false);
    }
  }

  const displayCustomers: RecentCustomer[] = liveCustomers;
  const displayActivity: LiveActivityItem[] = liveActivity;

  const totalMembersVal = liveStats.totalCustomers.toLocaleString();
  const stampsIssuedVal = liveStats.totalTransactions.toLocaleString();
  const rewardsRedeemedVal = liveStats.redeemedRewards.toLocaleString();
  const reviewClicksVal = (liveStats.reviewClicks || 0).toLocaleString();

  const rawGrowthData = useMemo(() => {
    if (growthView === "DAY") {
      if (dailyGrowth.length > 0) {
        return dailyGrowth.slice(-dayRange);
      }
      const now = new Date();
      return Array.from({ length: dayRange }, (_, idx) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayRange - 1 - idx));
        return {
          date: d.toISOString().split("T")[0],
          day: d.toLocaleDateString("en-IN", { weekday: "short" }),
          shortDate: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          label: idx === dayRange - 1 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" }),
          count: 0,
          phoneCount: 0,
          anonCount: 0,
        };
      });
    } else {
      if (monthlyGrowth.length > 0) {
        return monthlyGrowth.slice(-monthRange);
      }
      const now = new Date();
      return Array.from({ length: monthRange }, (_, idx) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (monthRange - 1 - idx), 1);
        return {
          month: d.toLocaleDateString("en-IN", { month: "short" }),
          label: d.toLocaleDateString("en-IN", { month: "short" }),
          fullMonth: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
          year: d.getFullYear(),
          count: 0,
          phoneCount: 0,
          anonCount: 0,
        };
      });
    }
  }, [growthView, dayRange, monthRange, dailyGrowth, monthlyGrowth]);

  const activeChartPointsData = useMemo(() => {
    return rawGrowthData.map((item) => {
      const activeCount =
        channelFilter === "PHONE"
          ? item.phoneCount
          : channelFilter === "ANON"
          ? item.anonCount
          : item.count;
      const primaryLabel = "day" in item ? item.day : item.month;
      const secondaryLabel = "shortDate" in item ? item.shortDate : "fullMonth" in item ? item.fullMonth : "";
      return {
        ...item,
        displayCount: activeCount,
        primaryLabel,
        secondaryLabel,
      };
    });
  }, [rawGrowthData, channelFilter]);

  const totalPeriodAcquired = activeChartPointsData.reduce((acc, d) => acc + d.displayCount, 0);
  const avgPeriodAcquired = (totalPeriodAcquired / Math.max(1, activeChartPointsData.length)).toFixed(1);
  const peakPeriodPoint = activeChartPointsData.reduce(
    (max, d) => (d.displayCount > max.displayCount ? d : max),
    activeChartPointsData[0]
  );

  const maxGrowth = Math.max(1, ...activeChartPointsData.map((m) => m.displayCount));
  const svgW = 500;
  const padX = 35;
  const plotWidth = svgW - padX * 2;
  const chartPoints = activeChartPointsData.map((m, idx) => {
    const x = padX + (idx / Math.max(1, activeChartPointsData.length - 1)) * plotWidth;
    const y = 135 - (m.displayCount / maxGrowth) * 95;
    return { ...m, x, y };
  });

  const chartPathD = chartPoints
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const chartAreaD = `${chartPathD} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} 150 L ${chartPoints[0].x.toFixed(1)} 150 Z`;

  const totalVouchers = liveStats.redeemedRewards + liveStats.unredeemedRewards;
  const redeemedPct = totalVouchers > 0 ? Math.round((liveStats.redeemedRewards / totalVouchers) * 100) : 0;
  const pendingPct = totalVouchers > 0 ? 100 - redeemedPct : 0;

  return (
    <div className="min-w-0 space-y-6 pb-12 font-sans sm:space-y-7 sm:pb-16">
      {/* ─────────────────────────────────────────────────────────────
          TOP BAR: DASHBOARD TITLE & DATE FILTER (Matching Reference Mockup)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-[#E8DFD1] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#24211E] sm:text-3xl">Dashboard</h1>
            <span className="rounded-full bg-[#EEF6F2] px-2.5 py-0.5 text-xs font-bold text-[#2E6B4F] border border-[#D1E7DC]">
              Live
            </span>
          </div>
          <p className="text-xs text-[#716B64] mt-0.5">
            Manage your program, track growth and understand your customers.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          {/* Dropdown filter from mockup: "Last 30 Days ⌵" */}
          <div className="relative">
            <select
              aria-label="Filter date range"
              value={dayRange}
              onChange={(e) => setDayRange(Number(e.target.value))}
              className="min-h-11 w-full appearance-none rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2 pr-8 text-sm font-semibold text-[#24211E] shadow-2xs outline-none transition hover:border-[#B58A4B] sm:min-h-10 sm:w-auto sm:text-xs"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#716B64]">
              ⌵
            </span>
          </div>

          {qrSlug && (
            <Link
              href={`/r/${qrSlug}`}
              target="_blank"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#B58A4B] px-3.5 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-[#9E7438] sm:min-h-10 sm:text-xs"
            >
              <span>📱 Customer QR Flow</span>
              <span className="text-[10px]">↗</span>
            </Link>
          )}
        </div>
      </div>

      {/* Real-time Customer Visit Stamp Requests Panel */}
      <OwnerStampRequestsPanel
        restaurantBrandColor="#B58A4B"
        onApprovedOrRejected={refreshDashboardData}
      />

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: 4 TOP KPI METRIC CARDS (Exact match to reference mockup)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* KPI 1: Loyalty Members */}
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-3 shadow-subtle transition hover:border-[#B58A4B] sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
              👥
            </span>
            <span className="rounded-full bg-[#EEF6F2] px-2 py-0.5 text-[10px] font-bold text-[#2E6B4F]">
              +12%
            </span>
          </div>
          <div className="mt-3">
            <div className="font-serif text-2xl font-bold text-[#24211E]">{totalMembersVal}</div>
            <div className="text-xs font-medium text-[#716B64] mt-0.5">Loyalty Members</div>
          </div>
        </div>

        {/* KPI 2: Stamps Issued */}
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-3 shadow-subtle transition hover:border-[#B58A4B] sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
              ☕
            </span>
            <span className="rounded-full bg-[#EEF6F2] px-2 py-0.5 text-[10px] font-bold text-[#2E6B4F]">
              +18%
            </span>
          </div>
          <div className="mt-3">
            <div className="font-serif text-2xl font-bold text-[#24211E]">{stampsIssuedVal}</div>
            <div className="text-xs font-medium text-[#716B64] mt-0.5">Stamps Issued</div>
          </div>
        </div>

        {/* KPI 3: Rewards Redeemed */}
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-3 shadow-subtle transition hover:border-[#B58A4B] sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
              🎁
            </span>
            <span className="rounded-full bg-[#EEF6F2] px-2 py-0.5 text-[10px] font-bold text-[#2E6B4F]">
              +22%
            </span>
          </div>
          <div className="mt-3">
            <div className="font-serif text-2xl font-bold text-[#24211E]">{rewardsRedeemedVal}</div>
            <div className="text-xs font-medium text-[#716B64] mt-0.5">Rewards Redeemed</div>
          </div>
        </div>

        {/* KPI 4: Review Clicks */}
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-3 shadow-subtle transition hover:border-[#B58A4B] sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
              📊
            </span>
            <span className="rounded-full bg-[#EEF6F2] px-2 py-0.5 text-[10px] font-bold text-[#2E6B4F]">
              +35%
            </span>
          </div>
          <div className="mt-3">
            <div className="font-serif text-2xl font-bold text-[#24211E]">{reviewClicksVal}</div>
            <div className="text-xs font-medium text-[#716B64] mt-0.5">Review Clicks</div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CHARTS ROW: Customer Growth Line Chart & Reward Redemptions Donut
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Customer Growth Line Chart */}
        <div className="min-w-0 rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6 lg:col-span-2">
          {/* Header & Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8DFD1]/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-base font-bold text-[#24211E]">Customer Growth</h3>
                <span className="rounded-full bg-[#FAF5ED] border border-[#E8D8BA] px-2 py-0.5 text-[10px] font-bold text-[#7A5826]">
                  {growthView === "DAY" ? "Daily Trend" : `${monthRange}-Month Trend`}
                </span>
              </div>
              <p className="text-[11px] text-[#716B64] mt-0.5">
                {growthView === "DAY"
                  ? "Daily customer acquisition across registered members & walk-ins"
                  : "Monthly customer acquisition over time"}
              </p>
            </div>

            {/* Toggle Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-[#FAF7F2] p-0.5 border border-[#E8DFD1] text-xs">
                <button
                  type="button"
                  onClick={() => setGrowthView("DAY")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    growthView === "DAY"
                      ? "bg-white text-[#24211E] shadow-2xs font-bold"
                      : "text-[#716B64] hover:text-[#24211E]"
                  }`}
                >
                  Day-wise
                </button>
                <button
                  type="button"
                  onClick={() => setGrowthView("MONTH")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    growthView === "MONTH"
                      ? "bg-white text-[#24211E] shadow-2xs font-bold"
                      : "text-[#716B64] hover:text-[#24211E]"
                  }`}
                >
                  Month-wise
                </button>
              </div>

              {growthView === "MONTH" && (
                <div className="flex items-center rounded-lg bg-[#FAF7F2] p-0.5 border border-[#E8DFD1] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMonthRange(6)}
                    className={`rounded px-2 py-0.5 transition ${
                      monthRange === 6
                        ? "bg-[#FAF5ED] text-[#7A5826] font-bold"
                        : "text-[#716B64] hover:text-[#24211E]"
                    }`}
                  >
                    6 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthRange(12)}
                    className={`rounded px-2 py-0.5 transition ${
                      monthRange === 12
                        ? "bg-[#FAF5ED] text-[#7A5826] font-bold"
                        : "text-[#716B64] hover:text-[#24211E]"
                    }`}
                  >
                    12 Months
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            {/* SVG Trend Spline matching the reference mockup */}
            <div className="relative h-44 w-full">
              <svg viewBox="0 0 500 160" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B58A4B" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#B58A4B" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Guide Lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="#E8DFD1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="0" y1="70" x2="500" y2="70" stroke="#E8DFD1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="0" y1="110" x2="500" y2="110" stroke="#E8DFD1" strokeDasharray="3 3" opacity="0.6" />

                {/* Area Fill */}
                <path d={chartAreaD} fill="url(#growthGrad)" />
                {/* Line Spline in Muted Gold */}
                <path d={chartPathD} fill="none" stroke="#B58A4B" strokeWidth="2.5" strokeLinecap="round" />

                {/* Data Points */}
                {chartPoints.map((p, idx) => {
                  const isHovered = hoveredPointIndex === idx;
                  const isPeak = p.displayCount === peakPeriodPoint?.displayCount && p.displayCount > 0;
                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                    >
                      <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? "6.5" : isPeak ? "5" : p.displayCount > 0 ? "4" : "3"}
                        fill={isHovered ? "#9E7438" : "#B58A4B"}
                        stroke="#FFFFFF"
                        strokeWidth={isHovered ? "2.5" : "1.8"}
                        className="transition-all"
                      />
                      {(p.displayCount > 0 || isHovered) && (
                        <text
                          x={p.x}
                          y={p.y - 7}
                          textAnchor="middle"
                          fontSize={isHovered ? "11" : "9"}
                          fontWeight="bold"
                          fill="#7A5826"
                        >
                          {p.displayCount}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Dynamic X-Axis Labels */}
              <div className="mt-2 flex justify-between px-6 text-[10px] font-semibold text-[#716B64]/70">
                {chartPoints.map((p, idx) => {
                  if (chartPoints.length > 10 && idx % 2 !== 0 && idx !== chartPoints.length - 1) {
                    return <span key={idx} className="opacity-0">{p.primaryLabel}</span>;
                  }
                  return (
                    <span
                      key={idx}
                      className={
                        hoveredPointIndex === idx
                          ? "text-[#B58A4B] font-bold"
                          : idx === chartPoints.length - 1
                          ? "text-[#24211E] font-bold"
                          : ""
                      }
                    >
                      {growthView === "DAY" && dayRange > 7 ? p.secondaryLabel || p.primaryLabel : p.primaryLabel}
                    </span>
                  );
                })}
              </div>

              {/* Hover Tooltip Card */}
              {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                <div
                  className="absolute pointer-events-none z-20 -top-8 rounded-xl border border-[#E8DFD1] bg-[#24211E] px-3 py-1.5 text-white shadow-xl text-[11px] backdrop-blur-sm transition"
                  style={{
                    left: `${Math.min(80, Math.max(10, (chartPoints[hoveredPointIndex].x / 500) * 100))}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <p className="font-bold text-[#E5B568]">
                    {chartPoints[hoveredPointIndex].secondaryLabel || chartPoints[hoveredPointIndex].primaryLabel}
                  </p>
                  <p className="text-stone-200 font-medium">
                    {chartPoints[hoveredPointIndex].displayCount} New Customer{chartPoints[hoveredPointIndex].displayCount !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reward Redemptions Donut Breakdown (Matching Mockup) */}
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-6 shadow-subtle flex flex-col justify-between">
          <div className="border-b border-[#E8DFD1]/60 pb-3">
            <h3 className="font-serif text-base font-bold text-[#24211E]">Reward Redemptions</h3>
            <p className="text-[11px] text-[#716B64]">Claimed vs Pending Vouchers</p>
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
                  stroke="#E8DFD1"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#B58A4B"
                  strokeWidth="3.5"
                  strokeDasharray={`${redeemedPct} ${100 - redeemedPct}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="font-serif text-2xl font-black text-[#24211E]">{liveStats.redeemedRewards}</span>
                <span className="block text-[9px] font-bold text-[#716B64] uppercase tracking-wider">Redeemed</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B58A4B]" />
                <span className="font-semibold text-[#24211E]">Redeemed ({redeemedPct}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E8DFD1]" />
                <span className="font-semibold text-[#716B64]">Pending ({pendingPct}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stamp Feedback Toast */}
      {quickStampFeedback && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-semibold shadow-xs transition ${
            quickStampFeedback.type === "success"
              ? "border border-[#D1E7DC] bg-[#EEF6F2] text-[#2E6B4F]"
              : "border border-[#F7D6D6] bg-[#FDF2F2] text-[#A83B3B]"
          }`}
        >
          {quickStampFeedback.type === "success" ? "✓ " : "⚠️ "}
          {quickStampFeedback.message}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TABLES ROW: Recent Customers & Recent Activity Feed
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Customers Table */}
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-6 shadow-subtle lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E8DFD1]/60 pb-3">
            <div>
              <h3 className="font-serif text-base font-bold text-[#24211E]">Recent Customers</h3>
              <p className="text-[11px] text-[#716B64]">Diners registered through the QR welcome flow</p>
            </div>
            <span className="text-xs font-semibold text-[#716B64]">
              {displayCustomers.length} Listed
            </span>
          </div>

          <div className="mt-3 lg:hidden">
            {displayCustomers.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#716B64]">
                <span className="mb-2 block text-3xl">👥</span>
                No customers yet. New diners will appear here after they join through your QR code.
              </div>
            ) : (
              <ul className="space-y-3">
                {displayCustomers.map((c) => (
                  <li key={c.id} className="rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] p-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8D8BA] bg-[#FAF5ED] text-sm font-bold text-[#7A5826]">
                          {c.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#24211E]">{c.name}</p>
                          <p className="text-xs text-[#716B64]">+91 {c.phone}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickStamp(c.phone, c.name)}
                        disabled={quickStampLoadingPhone === c.phone}
                        className="min-h-10 shrink-0 rounded-lg bg-[#B58A4B] px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-[#9E7438] disabled:opacity-50"
                      >
                        {quickStampLoadingPhone === c.phone ? "Adding…" : "+1 Stamp"}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#E8DFD1] pt-2 text-xs text-[#716B64]">
                      <span><strong className="text-[#24211E]">{c.visits}</strong> visits</span>
                      <span><strong className="text-[#24211E]">{c.stamps}/{stampsRequired}</strong> stamps</span>
                      <span>Last visit: {c.lastVisit}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 hidden overflow-x-auto lg:block">
            {displayCustomers.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#716B64]">
                <span className="text-3xl block mb-2">👥</span>
                No customers registered yet. When diners scan your QR code at tables, they appear here live!
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E8DFD1] text-[10px] font-bold text-[#716B64] uppercase tracking-wider">
                    <th className="py-2.5">Name</th>
                    <th className="py-2.5">Phone</th>
                    <th className="py-2.5 text-center">Visits</th>
                    <th className="py-2.5 text-center">Stamps</th>
                    <th className="py-2.5 text-right">Last Visit</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFD1]/50">
                  {displayCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAF7F2] transition">
                      <td className="py-3 font-semibold text-[#24211E]">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FAF5ED] text-[10px] font-bold text-[#7A5826] border border-[#E8D8BA]">
                            {c.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="truncate">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-[#716B64]">+91 {c.phone}</td>
                      <td className="py-3 text-center font-bold text-[#24211E]">{c.visits}</td>
                      <td className="py-3 text-center">
                        <span className="inline-block rounded-md bg-[#FAF5ED] border border-[#E8D8BA] px-2 py-0.5 font-bold text-[#7A5826]">
                          ☕ {c.stamps}/{stampsRequired}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[11px] text-[#716B64]">{c.lastVisit}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleQuickStamp(c.phone, c.name)}
                          disabled={quickStampLoadingPhone === c.phone}
                          className="rounded-lg bg-[#B58A4B] hover:bg-[#9E7438] text-white px-2.5 py-1 text-[11px] font-bold shadow-2xs transition active:scale-95 disabled:opacity-50"
                        >
                          {quickStampLoadingPhone === c.phone ? "..." : "+1 Stamp"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Activity Timeline Feed */}
        <div className="min-w-0 rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6">
          <div className="border-b border-[#E8DFD1]/60 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-base font-bold text-[#24211E]">Recent Activity</h3>
              <p className="text-[11px] text-[#716B64]">Live timeline of stamps &amp; offers</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF6F2] px-2 py-0.5 text-[10px] font-semibold text-[#2E6B4F] border border-[#D1E7DC]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2E6B4F] animate-pulse" />
              Live
            </span>
          </div>

          <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {displayActivity.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#716B64]">
                <span className="text-3xl block mb-2">📜</span>
                No activity recorded yet.
              </div>
            ) : (
              displayActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] text-xs hover:bg-[#F4ECE1] transition">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-[#E8DFD1] text-sm shadow-2xs">
                    {act.icon || (act.stampsCount && act.stampsCount > 0 ? "☕" : "🎁")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-[#24211E] truncate">
                        {act.title || act.customerName || act.customer?.name || act.customerPhone}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#716B64] truncate mt-0.5">
                      {act.description || (act.stampsCount && act.stampsCount > 0 ? `Earned a stamp (${act.billReference || "visit"})` : "Offer activity")}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#716B64]/70 mt-1">
                      <span>{new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          COUNTER TOOLS: Staff Stamp Issuance & Voucher Redeem
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Tool 1: Staff Stamp Tool */}
        <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6 sm:space-y-4">
          <div className="border-b border-[#E8DFD1]/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h3 className="font-serif text-base font-bold text-[#24211E]">Staff Stamp Tool</h3>
            </div>
            <p className="text-xs text-[#716B64]">
              Verify customer visit and award a loyalty stamp on qualifying bill.
            </p>
          </div>

          <form onSubmit={handleIssueStamp} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#716B64] mb-1">
                  Customer Mobile / ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={stampCustomerRef}
                  onChange={(e) => setStampCustomerRef(e.target.value)}
                  className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#716B64] mb-1">
                  Invoice / Bill Ref *
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-1042"
                  value={stampVisitRef}
                  onChange={(e) => setStampVisitRef(e.target.value)}
                  className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                  required
                />
              </div>
            </div>

            {stampFeedback && (
              <div
                className={`rounded-xl border p-2.5 text-xs font-semibold ${
                  stampFeedback.type === "success"
                    ? "border-[#D1E7DC] bg-[#EEF6F2] text-[#2E6B4F]"
                    : "border-[#F7D6D6] bg-[#FDF2F2] text-[#A83B3B]"
                }`}
              >
                {stampFeedback.message}
              </div>
            )}

            <button
              type="submit"
              disabled={stampLoading}
              className="rounded-xl bg-[#24211E] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-stone-800 transition disabled:opacity-60"
            >
              {stampLoading ? "Recording Visit..." : "⚡ Award 1 Stamp"}
            </button>
          </form>
        </div>

        {/* Tool 2: Staff Voucher Redemption Tool */}
        <div id="redeem-tool" className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6 sm:space-y-4">
          <div className="border-b border-[#E8DFD1]/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎟️</span>
              <h3 className="font-serif text-base font-bold text-[#24211E]">Voucher Redemption Tool</h3>
            </div>
            <p className="text-xs text-[#716B64]">
              Enter customer&apos;s voucher code or scan QR to mark reward as redeemed.
            </p>
          </div>

          <form onSubmit={handleRedeemVoucher} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#716B64] mb-1">
                Voucher Code *
              </label>
              <input
                type="text"
                placeholder="e.g. DBR-7F3K-9L2M"
                value={redeemVoucherCode}
                onChange={(e) => setRedeemVoucherCode(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-base font-mono font-bold text-[#24211E] outline-none uppercase focus:border-[#B58A4B] focus:bg-white sm:min-h-10 sm:text-sm"
                required
              />
            </div>

            {redeemFeedback && (
              <div
                className={`rounded-xl border p-2.5 text-xs font-semibold ${
                  redeemFeedback.type === "success"
                    ? "border-[#D1E7DC] bg-[#EEF6F2] text-[#2E6B4F]"
                    : "border-[#F7D6D6] bg-[#FDF2F2] text-[#A83B3B]"
                }`}
              >
                {redeemFeedback.message}
              </div>
            )}

            <button
              type="submit"
              disabled={redeemLoading}
              className="rounded-xl bg-[#B58A4B] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition disabled:opacity-60"
            >
              {redeemLoading ? "Redeeming..." : "Redeem Voucher Discount"}
            </button>
          </form>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: LOYALTY PROGRAM SETTINGS (Matching Mockup Right Panel)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-[#E8DFD1] bg-white p-4 shadow-subtle sm:p-6">
        <div className="border-b border-[#E8DFD1]/60 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold text-[#24211E]">Loyalty Program Settings</h2>
              <p className="text-xs text-[#716B64] mt-0.5">
                Fully customizable for each business.
              </p>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#FAF7F2] px-3 cursor-pointer sm:min-h-0 sm:justify-start sm:bg-transparent sm:px-0">
              <span className="text-xs font-bold text-[#24211E]">Program Active</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded text-[#B58A4B] accent-[#B58A4B] focus:ring-0"
              />
            </label>
          </div>
        </div>

        <form onSubmit={handleSaveProgram} className="mt-6 space-y-5">
          <h3 className="font-serif text-sm font-bold text-[#24211E]">Create / Edit Program</h3>

          {/* Field 1: Program Name */}
          <div>
            <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
              Program Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Daily Brew Rewards"
              className="min-h-11 w-full rounded-xl border border-[#E8DFD1] bg-white px-4 py-2.5 text-base font-semibold text-[#24211E] outline-none shadow-2xs focus:border-[#B58A4B] sm:min-h-10 sm:text-sm"
              required
            />
          </div>

          {/* Field 2: Stamps Required (Slider + Number) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#716B64]">
                Stamps Required
              </label>
              <span className="rounded-lg bg-[#FAF5ED] border border-[#E8D8BA] px-2.5 py-0.5 text-xs font-bold text-[#7A5826]">
                ☕ {stampsRequired} Stamps
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              value={stampsRequired}
              onChange={(e) => setStampsRequired(Number(e.target.value))}
              className="h-6 w-full accent-[#B58A4B] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#716B64]/70 mt-1">
              <span>1 stamp</span>
              <span>5 stamps (recommended)</span>
              <span>15 stamps</span>
            </div>
          </div>

          {/* Field 3: Reward Type (Radio Buttons from Mockup) */}
          <div>
            <label className="block text-xs font-semibold text-[#716B64] mb-2">
              Reward Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                onClick={() => handleTypeChange("PERCENT")}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  discountType === "PERCENT"
                    ? "border-[#B58A4B] bg-[#FAF5ED] shadow-2xs"
                    : "border-[#E8DFD1] bg-[#FAF7F2] hover:bg-[#F2ECE1]"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "PERCENT"}
                  onChange={() => handleTypeChange("PERCENT")}
                  className="accent-[#B58A4B]"
                />
                <span className="text-xs font-semibold text-[#24211E]">Percentage Discount</span>
              </label>

              <label
                onClick={() => handleTypeChange("FLAT")}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  discountType === "FLAT"
                    ? "border-[#B58A4B] bg-[#FAF5ED] shadow-2xs"
                    : "border-[#E8DFD1] bg-[#FAF7F2] hover:bg-[#F2ECE1]"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "FLAT"}
                  onChange={() => handleTypeChange("FLAT")}
                  className="accent-[#B58A4B]"
                />
                <span className="text-xs font-semibold text-[#24211E]">Fixed Discount (₹)</span>
              </label>

              <label
                onClick={() => handleTypeChange("FREE_ITEM")}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                  discountType === "FREE_ITEM"
                    ? "border-[#B58A4B] bg-[#FAF5ED] shadow-2xs"
                    : "border-[#E8DFD1] bg-[#FAF7F2] hover:bg-[#F2ECE1]"
                }`}
              >
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "FREE_ITEM"}
                  onChange={() => handleTypeChange("FREE_ITEM")}
                  className="accent-[#B58A4B]"
                />
                <span className="text-xs font-semibold text-[#24211E]">Free Item</span>
              </label>
            </div>
          </div>

          {/* Fields 4, 5, 6: Discount Value, Validity, Minimum Spend */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
                Discount Value {discountType === "PERCENT" ? "(%)" : discountType === "FLAT" ? "(₹)" : ""}
              </label>
              <input
                type="number"
                min={0}
                max={discountType === "PERCENT" ? 100 : 50000}
                value={rewardDiscountVal}
                onChange={(e) => setRewardDiscountVal(Number(e.target.value))}
                className="min-h-11 w-full rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2.5 text-base font-semibold text-[#24211E] outline-none shadow-2xs focus:border-[#B58A4B] sm:min-h-10 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
                Reward Validity (Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={rewardExpiryDays}
                onChange={(e) => setRewardExpiryDays(Number(e.target.value))}
                className="min-h-11 w-full rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2.5 text-base font-semibold text-[#24211E] outline-none shadow-2xs focus:border-[#B58A4B] sm:min-h-10 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
                Minimum Spend (Optional)
              </label>
              <input
                type="number"
                min={0}
                value={minBillRupees}
                onChange={(e) => setMinBillRupees(Number(e.target.value))}
                placeholder="0"
                className="min-h-11 w-full rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2.5 text-base font-semibold text-[#24211E] outline-none shadow-2xs focus:border-[#B58A4B] sm:min-h-10 sm:text-sm"
              />
            </div>
          </div>

          {/* Reward Display Title */}
          <div>
            <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
              Reward Headline shown to Diners
            </label>
            <input
              type="text"
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
              placeholder="e.g. 30% OFF on your next visit"
              className="min-h-11 w-full rounded-xl border border-[#E8DFD1] bg-white px-4 py-2.5 text-base font-semibold text-[#24211E] outline-none shadow-2xs focus:border-[#B58A4B] sm:min-h-10 sm:text-sm"
              required
            />
          </div>

          {saveSuccess && (
            <div className="rounded-xl border border-[#D1E7DC] bg-[#EEF6F2] p-3 text-xs font-bold text-[#2E6B4F]">
              ✅ {saveSuccess}
            </div>
          )}

          {saveError && (
            <div className="rounded-xl border border-[#F7D6D6] bg-[#FDF2F2] p-3 text-xs font-bold text-[#A83B3B]">
              ❌ {saveError}
            </div>
          )}

          {/* Button: Save Program (Muted Gold matching Mockup) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto rounded-2xl bg-[#B58A4B] px-8 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] active:scale-[0.98] transition disabled:opacity-60"
            >
              {saving ? "Saving Program..." : "Save Program"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
