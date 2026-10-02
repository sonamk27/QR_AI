"use client";

import { useState } from "react";
import { rupees } from "@/lib/plans";

export type OwnerPaymentItem = {
  id: string;
  invoiceNo: string | null;
  amount: number; // paise
  method: string;
  reference: string;
  status: string;
  gatewayOrderId: string | null;
  createdAt: string;
  qrName: string | null;
  qrRequestName: string | null;
};

export function OwnerPaymentReceiptModal({
  payment,
  restaurantName,
  restaurantCity,
  ownerName,
  ownerEmail,
  onClose,
}: {
  payment: OwnerPaymentItem;
  restaurantName: string;
  restaurantCity: string | null;
  ownerName: string;
  ownerEmail: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm print:bg-white print:p-0">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-2xl print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Modal Controls (hidden on print) */}
        <div className="flex items-center justify-between border-b border-line pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">Payment Receipt</span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
              {payment.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn !px-3 !py-1 text-xs"
            >
              🖨️ Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-ink/50 hover:text-ink text-sm px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="space-y-6 pt-4 text-ink">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-2xl font-bold tracking-tight text-leaf">
                ReviewFlow
              </p>
              <p className="text-xs text-ink/60">Automated Smart QR &amp; Review Management</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-ink">
                INVOICE #{payment.invoiceNo || payment.id.slice(0, 10).toUpperCase()}
              </p>
              <p className="text-xs text-ink/60">
                Date: {new Date(payment.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}
              </p>
            </div>
          </div>

          {/* Billed To & Payment Details */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-paper/40 p-4 text-xs">
            <div>
              <p className="font-semibold uppercase tracking-wider text-ink/60 mb-1">Billed To</p>
              <p className="font-bold text-sm text-ink">{restaurantName}</p>
              {restaurantCity && <p className="text-ink/70">{restaurantCity}</p>}
              <p className="text-ink/70 mt-1">{ownerName}</p>
              <p className="text-ink/60 font-mono">{ownerEmail}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold uppercase tracking-wider text-ink/60 mb-1">
                Payment Details
              </p>
              <p>
                <span className="text-ink/60">Method: </span>
                <span className="font-semibold">{payment.method}</span>
              </p>
              <p className="mt-0.5 font-mono text-[11px] truncate">
                <span className="text-ink/60">Ref/UTR: </span>
                <span>{payment.reference}</span>
              </p>
              {payment.gatewayOrderId && (
                <p className="mt-0.5 font-mono text-[11px] text-ink/60 truncate">
                  Order ID: {payment.gatewayOrderId}
                </p>
              )}
              <p className="mt-1">
                <span className="text-ink/60">Status: </span>
                <span className="font-bold text-emerald-700">{payment.status}</span>
              </p>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink/60">
                <th className="py-2">Description</th>
                <th className="py-2 text-center">Period</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              <tr>
                <td className="py-3">
                  <p className="font-semibold text-ink">
                    QR Code Subscription (
                    {payment.qrName || payment.qrRequestName || "Annual License"}
                    )
                  </p>
                  <p className="text-ink/60 text-[11px]">
                    Includes AI Review Generator, Google Review Directing, Analytics &amp; Instant Standee QR
                  </p>
                </td>
                <td className="py-3 text-center text-ink/70">365 Days</td>
                <td className="py-3 text-right font-medium text-ink">
                  {rupees(payment.amount)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-line text-sm font-semibold">
                <td colSpan={2} className="pt-3">
                  Total Paid
                </td>
                <td className="pt-3 text-right font-display text-lg text-leaf">
                  {rupees(payment.amount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer note */}
          <div className="border-t border-line/60 pt-4 text-center text-[11px] text-ink/50">
            Thank you for partnering with ReviewFlow. For billing inquiries, contact your account manager.
          </div>
        </div>
      </div>
    </div>
  );
}

export function OwnerPaymentsClientTable({
  payments,
  restaurantName,
  restaurantCity,
  ownerName,
  ownerEmail,
}: {
  payments: OwnerPaymentItem[];
  restaurantName: string;
  restaurantCity: string | null;
  ownerName: string;
  ownerEmail: string;
}) {
  const [selectedPayment, setSelectedPayment] = useState<OwnerPaymentItem | null>(null);

  return (
    <div className="space-y-4">
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[650px]">
          <thead>
            <tr>
              <th className="th">Invoice #</th>
              <th className="th">Description</th>
              <th className="th">Amount</th>
              <th className="th">Method</th>
              <th className="th">Reference / UTR</th>
              <th className="th">Status</th>
              <th className="th">Date</th>
              <th className="th">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="td text-center text-ink/60 py-10">
                  No payment records found for this restaurant.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-paper/40 transition">
                  <td className="td font-mono font-medium text-xs text-ink">
                    {p.invoiceNo || "—"}
                  </td>
                  <td className="td font-medium text-ink text-xs">
                    {p.qrName ? `QR: ${p.qrName}` : p.qrRequestName ? `Request: ${p.qrRequestName}` : "Subscription"}
                  </td>
                  <td className="td font-semibold text-leaf">{rupees(p.amount)}</td>
                  <td className="td">
                    <span className="inline-flex items-center rounded-full bg-paper px-2 py-0.5 text-xs text-ink font-medium border border-line">
                      {p.method}
                    </span>
                  </td>
                  <td className="td font-mono text-xs text-ink/70 max-w-[120px] truncate" title={p.reference}>
                    {p.reference}
                  </td>
                  <td className="td">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        p.status === "PAID" || p.status === "CONFIRMED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : p.status === "PENDING"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200"
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
                    <button
                      onClick={() => setSelectedPayment(p)}
                      className="btn-ghost !px-2.5 !py-1 text-xs"
                    >
                      View Receipt
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedPayment && (
        <OwnerPaymentReceiptModal
          payment={selectedPayment}
          restaurantName={restaurantName}
          restaurantCity={restaurantCity}
          ownerName={ownerName}
          ownerEmail={ownerEmail}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
}
