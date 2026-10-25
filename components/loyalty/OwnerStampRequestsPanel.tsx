"use client";

import { useEffect, useState } from "react";

export type PendingStampRequest = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  anonCustomerId: string | null;
  tableNo: string | null;
  qrSlug: string | null;
  createdAt: string;
  stampsAwarded: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  customer?: {
    currentStamps: number;
    lifetimeStamps: number;
  } | null;
  anonCustomer?: {
    currentStamps: number;
    lifetimeStamps: number;
  } | null;
};

export function OwnerStampRequestsPanel({
  restaurantBrandColor = "#1F6F5C",
  onApprovedOrRejected,
}: {
  restaurantBrandColor?: string;
  onApprovedOrRejected?: () => void;
}) {
  const [pendingRequests, setPendingRequests] = useState<PendingStampRequest[]>([]);
  const [recentRequests, setRecentRequests] = useState<PendingStampRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "recent">("pending");
  const [collectedStamp, setCollectedStamp] = useState<{
    requestId: string;
    customerName: string | null;
    customerPhone: string | null;
    tableNo: string | null;
    currentStamps: number | null;
    isAnon: boolean;
  } | null>(null);

  async function fetchRequests(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/loyalty/requests");
      const data = await res.json();
      if (res.ok) {
        setPendingRequests(data.pending || []);
        setRecentRequests(data.recent || []);
      }
    } catch (err) {
      console.error("Failed to fetch stamp requests:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Initial fetch and 5s auto-polling
  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => {
      fetchRequests(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleApprove(requestId: string, customerName: string | null) {
    setActionLoadingId(requestId);
    setActionMessage(null);
    try {
      const res = await fetch("/api/loyalty/requests/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve stamp");

      // Find the request details for the confirmation screen
      const req = pendingRequests.find((r) => r.id === requestId);
      setCollectedStamp({
        requestId,
        customerName: req?.customerName ?? customerName ?? null,
        customerPhone: req?.customerPhone ?? null,
        tableNo: req?.tableNo ?? null,
        currentStamps: req?.customer?.currentStamps ?? req?.anonCustomer?.currentStamps ?? null,
        isAnon: Boolean(req?.anonCustomerId),
      });

      setActionMessage({
        type: "success",
        text: data.message || `1 Stamp awarded to ${customerName || "customer"}!`,
      });
      setTimeout(() => setActionMessage(null), 5000);

      // Refresh list immediately
      await fetchRequests(true);
      onApprovedOrRejected?.();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to approve stamp request",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(requestId: string) {
    if (!confirm("Are you sure you want to decline this visit stamp request?")) return;

    setActionLoadingId(requestId);
    setActionMessage(null);
    try {
      const res = await fetch("/api/loyalty/requests/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to decline stamp");

      setActionMessage({
        type: "success",
        text: "Stamp request declined.",
      });
      setTimeout(() => setActionMessage(null), 4000);

      // Refresh list immediately
      await fetchRequests(true);
      onApprovedOrRejected?.();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to decline stamp request",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  function formatTimeAgo(isoString: string) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  }

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <h3 className="font-serif text-base font-bold text-stone-900">
              Customer Stamp Requests
            </h3>
            {pendingRequests.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white animate-pulse">
                {pendingRequests.length} Pending
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            Customers scanning your QR code request a visit stamp. Approve to add stamps to their card in real-time.
          </p>
        </div>

        {/* Live Indicator & Refresh Button */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            Live Sync
          </span>
          <button
            onClick={() => fetchRequests()}
            className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
            title="Refresh requests"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={`mt-3 rounded-xl p-3 text-xs font-semibold transition ${
            actionMessage.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {actionMessage.type === "success" ? "✓ " : "⚠️ "}
          {actionMessage.text}
        </div>
      )}

      {/* Stamp Collected Confirmation Screen */}
      {collectedStamp && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-xs animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl">
              ✓
            </div>
            <div>
              <h4 className="font-bold text-emerald-900">Stamp Collected</h4>
              <p className="text-xs text-emerald-700">1 stamp added to the customer's loyalty card.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Customer</p>
              <p className="text-stone-800 font-medium">{collectedStamp.customerName || "Diner"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Mobile</p>
              <p className="text-stone-800 font-medium">
                {collectedStamp.customerPhone ? `+91 ${collectedStamp.customerPhone}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Location</p>
              <p className="text-stone-800 font-medium">{collectedStamp.tableNo || "Table Visit"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Stamps</p>
              <p className="text-stone-800 font-medium">
                {collectedStamp.currentStamps !== null ? collectedStamp.currentStamps : "—"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCollectedStamp(null)}
            className="mt-4 w-full rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
          >
            Done — Back to Requests
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-2 border-b border-stone-100 pb-2">
        <button
          onClick={() => setActiveTab("pending")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            activeTab === "pending"
              ? "bg-stone-900 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          Pending Requests ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            activeTab === "recent"
              ? "bg-stone-900 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          Recent History ({recentRequests.length})
        </button>
      </div>

      {/* Pending List */}
      {activeTab === "pending" && (
        <div className="mt-4">
          {loading && pendingRequests.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">
              Checking for incoming stamp requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 py-8 text-center">
              <span className="text-3xl">☕</span>
              <p className="mt-2 text-xs font-bold text-stone-700">No pending stamp requests</p>
              <p className="mt-1 text-[11px] text-stone-400">
                When a customer scans a table QR and taps &ldquo;Collect My Stamp&rdquo;, their request will appear here instantly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const isLoading = actionLoadingId === req.id;
                return (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/60 to-white p-4 shadow-2xs transition hover:border-amber-300"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-xs"
                        style={{ backgroundColor: restaurantBrandColor }}
                      >
                        ☕
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900">
                            {req.customerName || "Diner"}
                          </h4>
                          {req.anonCustomerId ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-stone-500">
                              🔒 Anonymous
                            </span>
                          ) : req.customerPhone ? (
                            <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-stone-700">
                              +91 {req.customerPhone}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                            📍 {req.tableNo || "Table Visit"}
                          </span>
                          <span>•</span>
                          <span>{formatTimeAgo(req.createdAt)}</span>
                          {(req.anonCustomer || req.customer) && (
                            <>
                              <span>•</span>
                              <span className="font-medium text-stone-600">
                                Current Stamps: <strong>{req.anonCustomer?.currentStamps ?? req.customer?.currentStamps}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Approve / Decline */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={isLoading}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-rose-600 transition disabled:opacity-50"
                      >
                        ✕ Decline
                      </button>

                      <button
                        onClick={() => handleApprove(req.id, req.customerName)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
                        style={{ backgroundColor: restaurantBrandColor }}
                      >
                        <span>✓</span>
                        <span>{isLoading ? "Approving..." : "Approve Stamp (+1)"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recent History Tab */}
      {activeTab === "recent" && (
        <div className="mt-4">
          {recentRequests.length === 0 ? (
            <div className="py-6 text-center text-xs text-stone-400">
              No recent reviewed requests in the last 24 hours.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto pr-1">
              {recentRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-stone-800">
                      {req.customerName || req.customerPhone}
                    </span>
                    <span className="text-stone-400 ml-1.5">
                      ({req.tableNo || "Visit"})
                    </span>
                    <span className="text-stone-400 text-[10px] ml-2">
                      {formatTimeAgo(req.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      req.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {req.status === "APPROVED" ? "✓ Approved (+1 Stamp)" : "Declined"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
