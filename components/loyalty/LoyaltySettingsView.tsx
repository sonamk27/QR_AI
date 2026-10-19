"use client";

import { useState } from "react";
import Link from "next/link";

type Program = {
  id: string;
  title: string;
  isActive: boolean;
  stampsRequired: number;
  minBillAmount: number;
  rewardTitle: string;
  rewardDiscount: number;
  rewardExpiryDays: number;
  terminalPin: string;
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
  const [stampsRequired, setStampsRequired] = useState(initialProgram.stampsRequired);
  const [minBillRupees, setMinBillRupees] = useState(initialProgram.minBillAmount / 100);
  const [rewardTitle, setRewardTitle] = useState(initialProgram.rewardTitle);
  const [rewardDiscountRupees, setRewardDiscountRupees] = useState(initialProgram.rewardDiscount / 100);
  const [rewardExpiryDays, setRewardExpiryDays] = useState(initialProgram.rewardExpiryDays);
  const [terminalPin, setTerminalPin] = useState(initialProgram.terminalPin);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          stampsRequired: Number(stampsRequired),
          minBillAmountRupees: Number(minBillRupees),
          rewardTitle,
          rewardDiscountRupees: Number(rewardDiscountRupees),
          rewardExpiryDays: Number(rewardExpiryDays),
          terminalPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }

      setProgram(data.program);
      setSuccess("Loyalty program settings saved successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const sampleCustomerSpend = minBillRupees * stampsRequired;
  const rewardCostRatio = ((rewardDiscountRupees / sampleCustomerSpend) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Stamp & Loyalty Program
          </h1>
          <p className="mt-1 text-sm text-ink/70">
            Drive repeat visits with a digital loyalty card customers love.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/loyalty/terminal"
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
          >
            <span>💻 Open Staff Counter Terminal</span>
          </Link>

          {qrSlug && (
            <Link
              href={`/r/${qrSlug}/loyalty`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-bold text-ink shadow-xs hover:bg-stone-50 transition"
            >
              <span>📱 Preview Card ↗</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Loyalty Customers</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">{stats.totalCustomers}</p>
          <p className="mt-1 text-[11px] text-ink/50">Verified phone accounts</p>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Stamps Awarded</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">{stats.totalTransactions}</p>
          <p className="mt-1 text-[11px] text-ink/50">Total visits recorded</p>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Rewards Unlocked</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600">{stats.unredeemedRewards}</p>
          <p className="mt-1 text-[11px] text-ink/50">Waiting to be redeemed</p>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-medium text-ink/60">Rewards Redeemed</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600">{stats.redeemedRewards}</p>
          <p className="mt-1 text-[11px] text-ink/50">Used by happy customers</p>
        </div>
      </div>

      {/* SETTINGS FORM & FINANCIAL PROJECTION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSave} className="panel p-5 lg:col-span-2 space-y-4">
          <div className="border-b border-line pb-3">
            <h2 className="font-display text-base font-bold text-ink">Program Rules & Configuration</h2>
            <p className="text-xs text-ink/60">Define how customers qualify for stamps and unlock rewards.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Program Title
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
                Program Status
              </label>
              <select
                value={isActive ? "active" : "paused"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
              >
                <option value="active">Active (Customers earn stamps)</option>
                <option value="paused">Paused (Temporarily disabled)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Stamps Required for Reward
              </label>
              <input
                type="number"
                min={2}
                max={20}
                value={stampsRequired}
                onChange={(e) => setStampsRequired(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
                required
              />
              <p className="mt-1 text-[11px] text-ink/50">Typically 8 or 10 stamps.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Min. Purchase to Earn 1 Stamp (₹)
              </label>
              <input
                type="number"
                min={1}
                value={minBillRupees}
                onChange={(e) => setMinBillRupees(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
                required
              />
              <p className="mt-1 text-[11px] text-ink/50">e.g. ₹200 per stamp.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Reward Title
              </label>
              <input
                type="text"
                value={rewardTitle}
                onChange={(e) => setRewardTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
                required
              />
              <p className="mt-1 text-[11px] text-ink/50">e.g. ₹100 Off Your Bill</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Reward Discount Value (₹)
              </label>
              <input
                type="number"
                min={1}
                value={rewardDiscountRupees}
                onChange={(e) => setRewardDiscountRupees(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-stone-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Reward Validity (Days)
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Staff Terminal PIN (4-Digits)
              </label>
              <input
                type="text"
                maxLength={6}
                value={terminalPin}
                onChange={(e) => setTerminalPin(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-sm font-bold text-ink outline-none focus:border-stone-800"
                required
              />
              <p className="mt-1 text-[11px] text-ink/50">Used by counter staff to award stamps.</p>
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
              className="rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-stone-800 disabled:opacity-60 transition"
            >
              {saving ? "Saving Changes..." : "Save Program Settings"}
            </button>
          </div>
        </form>

        {/* ECONOMICS & REVENUE IMPACT PANEL */}
        <div className="panel p-5 space-y-4">
          <div className="border-b border-line pb-3">
            <h2 className="font-display text-base font-bold text-ink">Reward Economics</h2>
            <p className="text-xs text-ink/60">Estimated financial metrics per customer cycle.</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-line/60 pb-2">
              <span className="text-ink/60">Minimum Spend to Earn Reward:</span>
              <strong className="font-bold text-ink">₹{sampleCustomerSpend.toLocaleString("en-IN")}</strong>
            </div>

            <div className="flex justify-between border-b border-line/60 pb-2">
              <span className="text-ink/60">Customer Visits Required:</span>
              <strong className="font-bold text-ink">{stampsRequired} visits</strong>
            </div>

            <div className="flex justify-between border-b border-line/60 pb-2">
              <span className="text-ink/60">Reward Given:</span>
              <strong className="font-bold text-emerald-700">₹{rewardDiscountRupees} discount</strong>
            </div>

            <div className="flex justify-between pb-1">
              <span className="text-ink/60">Effective Discount %:</span>
              <strong className="font-bold text-ink">{rewardCostRatio}%</strong>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 p-3 text-[11px] text-amber-900">
            💡 <strong>Pro Tip:</strong> An effective discount between <strong>5% and 8%</strong> encourages repeat visits while preserving your food & beverage profit margins.
          </div>
        </div>
      </div>

      {/* RECENT STAMP TRANSACTIONS TABLE */}
      <div className="panel p-5">
        <div className="border-b border-line pb-3">
          <h2 className="font-display text-base font-bold text-ink">Recent Stamp Transactions</h2>
          <p className="text-xs text-ink/60">Real-time ledger of stamps awarded at your counter.</p>
        </div>

        {recentActivity.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink/50">
            No stamp transactions yet. Open the Staff Terminal to award your first stamp!
          </p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-ink/50 font-bold uppercase text-[10px]">
                  <th className="py-2">Customer</th>
                  <th className="py-2">Stamps</th>
                  <th className="py-2">Bill Amount</th>
                  <th className="py-2">Invoice / Ref</th>
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
                        ☕ +{tx.stampsCount}
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
