"use client";

import { useState, useMemo } from "react";
import { rupees } from "@/lib/plans";
import { useRouter } from "next/navigation";

type PaymentRow = {
  id: string;
  invoiceNo: string | null;
  amount: number; // paise
  method: "UPI" | "CASH" | "BANK" | "GATEWAY";
  reference: string;
  status: "RECORDED" | "CONFIRMED" | "REJECTED" | "PENDING" | "PAID";
  gatewayOrderId: string | null;
  qrRequestId: string | null;
  createdAt: string;
  restaurant: {
    id: string;
    name: string;
    city: string | null;
  };
  qr: {
    name: string;
  } | null;
  qrRequest: {
    name: string;
  } | null;
  recordedBy: {
    name: string;
  } | null;
};

function VerifyPaymentButton({ payment }: { payment: PaymentRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (!payment.qrRequestId || !confirm("Verify this manual payment and activate the requested QR codes?")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/super-admin/qr-requests/${payment.qrRequestId}/verify-payment`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to verify payment");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button onClick={verify} disabled={busy} className="btn !px-2.5 !py-1 text-xs">
        {busy ? "Verifying…" : "Verify"}
      </button>
      {error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

export function PaymentsAdminTable({ payments }: { payments: PaymentRow[] }) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (methodFilter !== "ALL" && p.method !== methodFilter) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.invoiceNo && p.invoiceNo.toLowerCase().includes(q)) ||
        p.restaurant.name.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        (p.gatewayOrderId && p.gatewayOrderId.toLowerCase().includes(q)) ||
        (p.qr && p.qr.name.toLowerCase().includes(q)) ||
        (p.qrRequest && p.qrRequest.name.toLowerCase().includes(q))
      );
    });
  }, [payments, search, methodFilter, statusFilter]);

  const totalFilteredAmount = useMemo(() => {
    return filtered
      .filter((p) => p.status === "CONFIRMED" || p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filtered]);

  function exportCSV() {
    const headers = [
      "Invoice #",
      "Restaurant",
      "City",
      "QR / Request",
      "Amount (INR)",
      "Method",
      "Reference / Order ID",
      "Status",
      "Date",
    ];

    const rows = filtered.map((p) => [
      `"${p.invoiceNo || ""}"`,
      `"${p.restaurant.name.replace(/"/g, '""')}"`,
      `"${p.restaurant.city || ""}"`,
      `"${(p.qr?.name || p.qrRequest?.name || "General").replace(/"/g, '""')}"`,
      (p.amount / 100).toFixed(2),
      p.method,
      `"${p.reference}"`,
      p.status,
      new Date(p.createdAt).toISOString().split("T")[0],
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `reviewflow-payments-${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-4">
      {/* Search, Filter, and Export Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search invoice #, restaurant, ref/UTR…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-sm"
          />

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="input !w-auto"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="UPI">UPI</option>
            <option value="GATEWAY">Online Gateway</option>
            <option value="BANK">Bank Transfer</option>
            <option value="CASH">Cash</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input !w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="RECORDED">Awaiting verification</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {(search || methodFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setMethodFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="text-xs text-ink/50 hover:text-ink underline px-2"
            >
              Reset
            </button>
          )}
        </div>

        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="btn-ghost flex items-center gap-1.5 whitespace-nowrap text-xs"
        >
          <span>📥 Export CSV</span>
          <span className="text-ink/50">({filtered.length})</span>
        </button>
      </div>

      {/* Filtered Summary Card */}
      <div className="flex items-center justify-between rounded-lg border border-line bg-paper/50 px-4 py-2.5 text-xs text-ink/80">
        <span>
          Showing <strong className="text-ink">{filtered.length}</strong> of{" "}
          <strong>{payments.length}</strong> transactions
        </span>
        <span>
          Filtered Confirmed Revenue:{" "}
          <strong className="text-leaf text-sm">{rupees(totalFilteredAmount)}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="th">Invoice #</th>
              <th className="th">Restaurant</th>
              <th className="th">QR / Request</th>
              <th className="th">Amount</th>
              <th className="th">Method</th>
              <th className="th">Reference / UTR</th>
              <th className="th">Status</th>
              <th className="th">Date</th>
              <th className="th">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="td text-center text-ink/60 py-10">
                  {payments.length === 0
                    ? "No payment records found."
                    : "No payments match the selected filters."}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-paper/40 transition">
                  <td className="td font-mono font-medium text-xs text-ink">
                    {p.invoiceNo || "–"}
                  </td>
                  <td className="td font-medium text-ink">
                    <p>{p.restaurant.name}</p>
                    <p className="text-xs font-normal text-ink/60">{p.restaurant.city || "—"}</p>
                  </td>
                  <td className="td text-xs text-ink/80">
                    {p.qr?.name || p.qrRequest?.name || "General"}
                  </td>
                  <td className="td font-semibold text-leaf">{rupees(p.amount)}</td>
                  <td className="td">
                    <span className="inline-flex items-center rounded-full bg-paper px-2.5 py-0.5 text-xs font-medium text-ink border border-line">
                      {p.method}
                    </span>
                  </td>
                  <td className="td font-mono text-xs text-ink/80 max-w-[150px] truncate" title={p.reference}>
                    {p.reference}
                  </td>
                  <td className="td">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        p.status === "PAID" || p.status === "CONFIRMED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : p.status === "PENDING"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : p.status === "RECORDED"
                          ? "bg-violet-50 text-violet-700 border-violet-200"
                          : p.status === "REJECTED"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="td text-xs text-ink/70">
                    {new Date(p.createdAt).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td className="td">
                    {p.status === "RECORDED" && p.qrRequestId && (
                      <VerifyPaymentButton payment={p} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
