"use client";

import { useState } from "react";
import Link from "next/link";

export function StaffTerminalView({
  restaurant,
  initialPin,
}: {
  restaurant: {
    id: string;
    name: string;
    brandColor: string;
  };
  initialPin?: string;
}) {
  const [pin, setPin] = useState(initialPin || "");
  const [pinVerified, setPinVerified] = useState(Boolean(initialPin));
  const [pinInput, setPinInput] = useState("");
  const [tab, setTab] = useState<"award" | "redeem">("award");

  // Award stamp form state
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billReference, setBillReference] = useState("");
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState<string | null>(null);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Redeem form state
  const [rewardCode, setRewardCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setPin(pinInput.trim());
    setPinVerified(true);
  }

  async function handleAwardStamp(e: React.FormEvent) {
    e.preventDefault();
    setAwardLoading(true);
    setAwardSuccess(null);
    setAwardError(null);

    try {
      const res = await fetch("/api/loyalty/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          phone,
          customerName,
          billAmountRupees: billAmount,
          billReference,
          terminalPin: pin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setPinVerified(false);
          throw new Error("Invalid terminal PIN. Please re-enter.");
        }
        throw new Error(data.error || "Failed to award stamp");
      }

      setAwardSuccess(data.message);
      // Reset bill inputs, keep phone for convenience
      setBillAmount("");
      setBillReference("");
    } catch (err: any) {
      setAwardError(err.message || "Failed to award stamp");
    } finally {
      setAwardLoading(false);
    }
  }

  async function handleRedeemReward(e: React.FormEvent) {
    e.preventDefault();
    setRedeemLoading(true);
    setRedeemSuccess(null);
    setRedeemError(null);

    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          rewardCode: rewardCode.trim().toUpperCase(),
          terminalPin: pin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setPinVerified(false);
          throw new Error("Invalid terminal PIN. Please re-enter.");
        }
        throw new Error(data.error || "Failed to redeem reward");
      }

      setRedeemSuccess(data.message);
      setRewardCode("");
    } catch (err: any) {
      setRedeemError(err.message || "Failed to redeem reward");
    } finally {
      setRedeemLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg pb-10">
      {/* Mini Terminal Header */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3.5 rounded-t-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-bold text-stone-900 leading-tight">
              {restaurant.name} • Counter Terminal
            </h1>
          </div>
          <p className="text-[11px] text-stone-500">Staff Stamp & Reward Scanner</p>
        </div>

        <div className="flex items-center gap-2">
          {pinVerified && (
            <button
              onClick={() => {
                setPinVerified(false);
                setPinInput("");
              }}
              className="text-[11px] font-semibold text-stone-400 hover:text-stone-700 underline"
            >
              Lock Terminal
            </button>
          )}
        </div>
      </div>

      <div className="rounded-b-2xl border border-t-0 border-stone-200 bg-white p-5 shadow-sm">
        {!pinVerified ? (
          <form onSubmit={handlePinSubmit} className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-2xl">
              🔐
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                Staff Terminal PIN
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Enter your 4-digit staff terminal PIN to award stamps or redeem rewards.
              </p>
            </div>

            <div className="mx-auto max-w-xs">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="Enter 4-digit PIN (default 1234)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full rounded-xl border border-stone-300 py-3 text-center font-mono text-xl tracking-widest outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full max-w-xs rounded-xl bg-stone-900 py-3 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
            >
              Unlock Terminal →
            </button>
          </form>
        ) : (
          <div>
            {/* TABS */}
            <div className="flex rounded-xl bg-stone-100 p-1 text-xs font-bold text-stone-600 mb-5">
              <button
                type="button"
                onClick={() => setTab("award")}
                className={`flex-1 rounded-lg py-2 transition ${
                  tab === "award" ? "bg-white text-stone-900 shadow-xs" : "hover:text-stone-900"
                }`}
              >
                ☕ Award Stamp
              </button>
              <button
                type="button"
                onClick={() => setTab("redeem")}
                className={`flex-1 rounded-lg py-2 transition ${
                  tab === "redeem" ? "bg-white text-stone-900 shadow-xs" : "hover:text-stone-900"
                }`}
              >
                🎁 Redeem Voucher
              </button>
            </div>

            {/* TAB 1: AWARD STAMP */}
            {tab === "award" && (
              <form onSubmit={handleAwardStamp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                    Customer Mobile Number *
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-stone-300 bg-stone-50/50 focus-within:border-stone-800 focus-within:bg-white transition">
                    <span className="flex items-center pl-3.5 pr-2 text-sm font-semibold text-stone-400">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-transparent py-2.5 pr-3 text-sm font-medium text-stone-900 outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                      Bill Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 250"
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-medium text-stone-900 outline-none focus:border-stone-800"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                      Bill / Receipt #
                    </label>
                    <input
                      type="text"
                      placeholder="INV-0012 (optional)"
                      value={billReference}
                      onChange={(e) => setBillReference(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-medium text-stone-900 outline-none focus:border-stone-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                    Customer Name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Guest Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-900 outline-none focus:border-stone-800"
                  />
                </div>

                {awardSuccess && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-in fade-in">
                    {awardSuccess}
                  </div>
                )}

                {awardError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 animate-in fade-in">
                    {awardError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={awardLoading}
                  className="w-full rounded-xl bg-stone-900 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-stone-800 active:scale-[0.99] disabled:opacity-60 transition"
                >
                  {awardLoading ? "Awarding Stamp..." : "Award 1 Stamp ☕"}
                </button>
              </form>
            )}

            {/* TAB 2: REDEEM REWARD */}
            {tab === "redeem" && (
              <form onSubmit={handleRedeemReward} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                    Reward Voucher Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RWD-8392A"
                    value={rewardCode}
                    onChange={(e) => setRewardCode(e.target.value.toUpperCase())}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-center font-mono text-xl font-bold tracking-widest text-stone-900 outline-none focus:border-stone-800 uppercase"
                    required
                  />
                  <p className="mt-1 text-[11px] text-stone-400">
                    Ask customer for the code shown in their Rewards tab or scan from their phone.
                  </p>
                </div>

                {redeemSuccess && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-in fade-in">
                    {redeemSuccess}
                  </div>
                )}

                {redeemError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 animate-in fade-in">
                    {redeemError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={redeemLoading}
                  className="w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-60 transition"
                >
                  {redeemLoading ? "Verifying..." : "Verify & Deduct Discount 🎁"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between px-2 text-xs text-stone-400">
        <Link href="/dashboard/loyalty" className="hover:text-stone-700 underline">
          ← Back to Loyalty Settings
        </Link>
        <span>ReviewFlow Terminal</span>
      </div>
    </div>
  );
}
