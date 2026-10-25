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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:bg-white print:p-0">
      <div className="w-full max-w-xl rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-2xl print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Modal Controls (hidden on print) */}
        <div className="flex items-center justify-between border-b border-[#E8DFD1]/60 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-[#24211E]">Payment Receipt</span>
            <span className="rounded-full bg-[#EEF6F2] px-2.5 py-0.5 text-xs font-semibold text-[#2E6B4F] border border-[#D1E7DC]">
              {payment.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-[#B58A4B] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition"
            >
              🖨️ Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[#716B64] hover:text-[#24211E] text-sm px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="space-y-6 pt-4 text-[#24211E]">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-2xl font-bold tracking-tight text-[#24211E]">
                ReviewFlow
              </p>
              <p className="text-xs text-[#716B64] font-medium">Automated Smart QR &amp; Review Management</p>
              <div className="mt-1.5 text-[11px] text-[#716B64] space-y-0.5">
                <p>
                  <span className="text-[#716B64]/60">Billing Desk: </span>
                  <a href="mailto:billing@reviewflow.in" className="text-[#B58A4B] hover:underline">
                    billing@reviewflow.in
                  </a>
                </p>
                <p>
                  <span className="text-[#716B64]/60">Helpline: </span>
                  <a href="tel:+919876543210" className="text-[#B58A4B] hover:underline">
                    +91 98765 43210
                  </a>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-bold text-[#24211E]">
                INVOICE #{payment.invoiceNo || payment.id.slice(0, 10).toUpperCase()}
              </p>
              <p className="text-[11px] text-[#716B64]">
                Date: {new Date(payment.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}
              </p>
            </div>
          </div>

          {/* Billed To & Payment Details */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-[#E8DFD1] bg-[#FAF7F2] p-4 text-xs">
            <div>
              <p className="font-bold uppercase tracking-wider text-[10px] text-[#716B64] mb-1">
                Billed To (Client Contact)
              </p>
              <p className="font-bold text-sm text-[#24211E]">{restaurantName}</p>
              {restaurantCity && <p className="text-[#716B64] text-xs">{restaurantCity}</p>}
              <div className="mt-2 space-y-0.5 border-t border-[#E8DFD1]/60 pt-2 text-xs">
                <p>
                  <span className="text-[#716B64]">Contact Person: </span>
                  <span className="font-medium text-[#24211E]">{ownerName || "Authorized Representative"}</span>
                </p>
                <p>
                  <span className="text-[#716B64]">Contact Email: </span>
                  <a href={`mailto:${ownerEmail}`} className="font-mono text-[#B58A4B] hover:underline">
                    {ownerEmail || "—"}
                  </a>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold uppercase tracking-wider text-[10px] text-[#716B64] mb-1">
                Payment Details
              </p>
              <p>
                <span className="text-[#716B64]">Method: </span>
                <span className="font-semibold text-[#24211E]">{payment.method}</span>
              </p>
              <p className="mt-0.5 font-mono text-[11px] truncate text-[#716B64]">
                Ref/UTR: {payment.reference}
              </p>
              {payment.gatewayOrderId && (
                <p className="mt-0.5 font-mono text-[11px] text-[#716B64]/70 truncate">
                  Order ID: {payment.gatewayOrderId}
                </p>
              )}
              <p className="mt-1">
                <span className="text-[#716B64]">Status: </span>
                <span className="font-bold text-[#2E6B4F]">{payment.status}</span>
              </p>
            </div>
          </div>

          {/* Itemized Table */}
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8DFD1] text-[10px] font-bold uppercase tracking-wider text-[#716B64]">
                <th className="py-2">Description</th>
                <th className="py-2 text-center">Period</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFD1]/50">
              <tr>
                <td className="py-3">
                  <p className="font-semibold text-[#24211E]">
                    QR Code Subscription (
                    {payment.qrName || payment.qrRequestName || "Annual License"}
                    )
                  </p>
                  <p className="text-[#716B64] text-[11px]">
                    Includes AI Review Generator, Loyalty Card &amp; Instant Standee QR
                  </p>
                </td>
                <td className="py-3 text-center text-[#716B64]">365 Days</td>
                <td className="py-3 text-right font-medium text-[#24211E]">
                  {rupees(payment.amount)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E8DFD1] text-sm font-semibold">
                <td colSpan={2} className="pt-3 font-bold text-[#24211E]">
                  Total Paid
                </td>
                <td className="pt-3 text-right font-serif text-lg font-bold text-[#B58A4B]">
                  {rupees(payment.amount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer note */}
          <div className="border-t border-[#E8DFD1]/60 pt-3 text-center text-[11px] text-[#716B64]/60">
            Thank you for partnering with ReviewFlow. This is an electronically generated official receipt.
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
      <div className="rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-xs">
          <thead>
            <tr className="border-b border-[#E8DFD1] bg-[#FAF7F2] text-[10px] font-bold uppercase tracking-wider text-[#716B64]">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference / UTR</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8DFD1]/50">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs text-[#716B64]">
                  No payment records found for this restaurant.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAF7F2] transition">
                  <td className="px-4 py-3.5 font-mono font-medium text-xs text-[#24211E]">
                    {p.invoiceNo || "—"}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-[#24211E] text-xs">
                    {p.qrName ? `QR: ${p.qrName}` : p.qrRequestName ? `Request: ${p.qrRequestName}` : "Subscription"}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-[#B58A4B]">{rupees(p.amount)}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded-md bg-[#FAF7F2] px-2 py-0.5 text-xs text-[#716B64] font-medium border border-[#E8DFD1]">
                      {p.method}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-[#716B64] max-w-[120px] truncate" title={p.reference}>
                    {p.reference}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                        p.status === "PAID" || p.status === "CONFIRMED"
                          ? "bg-[#EEF6F2] text-[#2E6B4F] border-[#D1E7DC]"
                          : p.status === "PENDING"
                          ? "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]"
                          : "bg-[#FAF7F2] text-[#716B64] border-[#E8DFD1]"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#716B64]">
                    {new Date(p.createdAt).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedPayment(p)}
                        className="rounded-xl border border-[#E8DFD1] bg-white px-2.5 py-1 text-xs font-semibold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition"
                      >
                        View Receipt
                      </button>
                    </div>
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
