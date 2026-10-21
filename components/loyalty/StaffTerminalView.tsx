"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export type TerminalProgramInfo = {
  id: string;
  title: string;
  stampsRequired: number;
  minBillAmount: number; // in paise
  rewardTitle: string;
  rewardDiscount: number; // in paise
  rewardExpiryDays: number;
  isActive: boolean;
};

export function StaffTerminalView({
  restaurant,
  initialPin,
  slug,
  initialProgram,
}: {
  restaurant: {
    id: string;
    name: string;
    brandColor: string;
  };
  initialPin?: string;
  slug?: string;
  initialProgram?: TerminalProgramInfo;
}) {
  const [pin, setPin] = useState(initialPin || "");
  const [pinVerified, setPinVerified] = useState(Boolean(initialPin));
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isDefaultPin, setIsDefaultPin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [tab, setTab] = useState<"award" | "redeem">("award");
  const [program] = useState<TerminalProgramInfo | undefined>(initialProgram);

  // Restore PIN from sessionStorage on mount and verify it
  useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`staff_terminal_pin_${restaurant.id}`);
      if (saved) {
        setPin(saved);
        setPinVerified(true);
      }
    }
  });

  // Award stamp form state
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billReference, setBillReference] = useState("");
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState<string | null>(null);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Live customer lookup state
  const [customerLookup, setCustomerLookup] = useState<{
    phone: string;
    name: string | null;
    currentStamps: number;
    lifetimeStamps: number;
    rewards?: Array<{ code: string; rewardTitle: string; status: string }>;
  } | null>(null);

  // Redeem form state
  const [rewardCode, setRewardCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Live customer lookup when 10-digit phone is entered
  useEffect(() => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length >= 10) {
      const formatted = cleanPhone.length > 10 && cleanPhone.startsWith("91") ? cleanPhone.slice(2) : cleanPhone;
      fetch("/api/loyalty/customer/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted, action: "lookup" }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.found && res.customer) {
            setCustomerLookup(res.customer);
            if (!customerName && res.customer.name) {
              setCustomerName(res.customer.name);
            }
          } else {
            setCustomerLookup(null);
          }
        })
        .catch(() => {});
    } else {
      setCustomerLookup(null);
    }
  }, [phone]);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    if (!pinInput.trim()) return;

    const cleanPin = pinInput.trim();
    setPinLoading(true);

    try {
      const res = await fetch("/api/loyalty/terminal/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          slug,
          pin: cleanPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setIsLocked(true);
        }
        throw new Error(data.error || "Invalid PIN");
      }

      setPin(cleanPin);
      setPinVerified(true);
      setIsDefaultPin(Boolean(data.isDefaultPin));
      setIsLocked(false);
      setPinError(null);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(`staff_terminal_pin_${restaurant.id}`, cleanPin);
      }
    } catch (err: any) {
      setPinError(err.message || "Failed to verify PIN");
    } finally {
      setPinLoading(false);
    }
  }

  function handleLock() {
    setPinVerified(false);
    setPinInput("");
    setPin("");
    setPinError(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`staff_terminal_pin_${restaurant.id}`);
    }
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
              onClick={handleLock}
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
              {isLocked ? "⛔" : "🔐"}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                Staff Terminal PIN
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Enter your 4-digit staff terminal PIN to award stamps or redeem rewards.
              </p>
            </div>

            {pinError && (
              <div className="mx-auto max-w-xs rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-medium">
                {pinError}
              </div>
            )}

            <div className="mx-auto max-w-xs">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                disabled={isLocked || pinLoading}
                placeholder="Enter 4-digit PIN (default 1234)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full rounded-xl border border-stone-300 py-3 text-center font-mono text-xl tracking-widest outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 disabled:opacity-50 disabled:bg-stone-100"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLocked || pinLoading}
              className="w-full max-w-xs rounded-xl bg-stone-900 py-3 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition disabled:opacity-50"
            >
              {pinLoading ? "Verifying PIN..." : isLocked ? "Locked (Wait 15m)" : "Unlock Terminal →"}
            </button>
          </form>
        ) : (
          <div>
            {isDefaultPin && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div>
                  <span className="font-bold">Security Notice: </span>
                  This terminal is using the default PIN (<strong>1234</strong>). To protect stamps from unauthorized access, change your staff PIN in <strong>Dashboard → Loyalty Settings</strong>.
                </div>
              </div>
            )}
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
                {/* Dynamic Program Offer Banner */}
                {program && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold text-amber-900">☕ {program.title}</div>
                      <div className="text-amber-800/80 mt-0.5">
                        <span className="font-semibold">{program.stampsRequired} stamps</span> to earn{" "}
                        <span className="font-semibold">{program.rewardTitle}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-amber-700 font-semibold">Min. Bill</div>
                      <div className="text-sm font-extrabold text-amber-900">₹{Math.round(program.minBillAmount / 100)}</div>
                    </div>
                  </div>
                )}

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

                {/* Live Customer Stamp Preview */}
                {customerLookup && program && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Customer Found
                      </span>
                      {customerLookup.lifetimeStamps >= 20 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                          VIP 👑
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-stone-900">
                          {customerLookup.name || `+91 ${customerLookup.phone}`}
                        </div>
                        <div className="text-xs text-stone-500">
                          Lifetime stamps: {customerLookup.lifetimeStamps}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-extrabold text-stone-900">
                          {customerLookup.currentStamps}
                          <span className="text-sm font-semibold text-stone-400">
                            /{program.stampsRequired}
                          </span>
                        </div>
                        {/* Mini stamp track */}
                        <div className="flex gap-0.5 mt-1">
                          {Array.from({ length: program.stampsRequired }).map((_, i) => (
                            <div
                              key={i}
                              className={`h-2 w-2 rounded-full transition ${
                                i < customerLookup.currentStamps
                                  ? "bg-amber-600"
                                  : "bg-stone-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {customerLookup.rewards?.some(r => r.status === "UNREDEEMED") && (
                      <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] text-emerald-800 font-semibold">
                        🎁 This customer has an unredeemed reward! Use &quot;Redeem Voucher&quot; tab.
                      </div>
                    )}
                  </div>
                )}

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
        {slug ? (
          <Link href={`/r/${slug}/loyalty`} className="hover:text-stone-700 underline">
            ← Customer Card View
          </Link>
        ) : (
          <Link href="/dashboard/loyalty" className="hover:text-stone-700 underline">
            ← Back to Loyalty Settings
          </Link>
        )}
        <span>ReviewFlow Terminal</span>
      </div>
    </div>
  );
}
