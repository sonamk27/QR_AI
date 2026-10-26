"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupees } from "@/lib/plans";

type QrRequestItem = {
  id: string;
  name: string;
  location?: string | null;
  tableNo?: string | null;
  quantity: number;
  note?: string | null;
  status: "PENDING_APPROVAL" | "APPROVED_PAYMENT_DUE" | "PAID" | "ACTIVE" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  restaurant?: { name: string };
  qrCodes: { id: string; slug: string; status: string }[];
  payments: {
    id: string;
    status: string;
    amount: number;
    method?: string;
    reference?: string;
  }[];
};

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; description: string }
> = {
  PENDING_APPROVAL: {
    label: "Pending Approval",
    className: "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]",
    description: "Waiting for admin review",
  },
  APPROVED_PAYMENT_DUE: {
    label: "Approved – Payment Due",
    className: "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]",
    description: "Your request is approved. Scan the payment QR; an administrator will verify your payment.",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-[#FDF2F2] text-[#A83B3B] border-[#F7D6D6]",
    description: "Request was rejected",
  },
  RECORDED: {
    label: "Payment submitted – verification pending",
    className: "bg-[#FAF5ED] text-[#7A5826] border-[#E8D8BA]",
    description: "Your payment is awaiting admin verification.",
  },
  PAID: {
    label: "Paid",
    className: "bg-[#EEF6F2] text-[#2E6B4F] border-[#D1E7DC]",
    description: "Payment received; your QR codes are active.",
  },
  ACTIVE: {
    label: "Paid · Active",
    className: "bg-[#EEF6F2] text-[#2E6B4F] border-[#D1E7DC]",
    description: "Payment verified. Your QR codes are active.",
  },
};

function ManualPaymentForm({
  request,
  allowTestPayment,
  paymentUnitPaise,
}: {
  request: QrRequestItem;
  allowTestPayment: boolean;
  paymentUnitPaise: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const recordedPayment = request.payments.find((p) => p.status === "RECORDED");
  const paidPayment = request.payments.find((p) => p.status === "PAID");
  const totalPaise = paymentUnitPaise * request.quantity;

  if (paidPayment) {
    return (
      <span className="inline-flex items-center rounded-full border bg-[#EEF6F2] text-[#2E6B4F] border-[#D1E7DC] px-2.5 py-0.5 text-xs font-semibold">
        ✓ Payment Complete
      </span>
    );
  }

  async function simulateTestPayment() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/qr-requests/test-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrRequestId: request.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to simulate test payment");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (recordedPayment) {
    return (
      <div className="text-xs text-[#7A5826] font-semibold bg-[#FAF5ED] px-3 py-1.5 rounded-xl border border-[#E8D8BA]">
        Payment submitted; awaiting admin verification.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 text-center shadow-subtle">
        <p className="font-serif text-sm font-bold text-[#24211E]">Scan to pay {rupees(totalPaise)}</p>
        <img
          src="/payment-qr.jpeg"
          alt="UPI payment QR code"
          className="mx-auto my-2.5 h-44 w-44 object-contain rounded-xl border border-[#E8DFD1]"
        />
        <p className="text-[11px] text-[#716B64] leading-relaxed">
          Scan with any UPI app. Once paid, the administrator will verify and activate your QR code.
        </p>
      </div>
      {allowTestPayment && (
        <button
          type="button"
          onClick={simulateTestPayment}
          disabled={busy}
          className="rounded-xl bg-[#B58A4B] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#9E7438] transition disabled:opacity-50"
        >
          {busy ? "Processing…" : "Simulate test payment"}
        </button>
      )}
      {error && <p className="text-xs text-[#A83B3B]">{error}</p>}
    </div>
  );
}

export function QrRequestForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    location: "",
    tableNo: "",
    quantity: 1,
    note: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/qr-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          location: form.location || undefined,
          tableNo: form.tableNo || undefined,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        setForm({ name: "", location: "", tableNo: "", quantity: 1, note: "" });
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-[#B58A4B] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition whitespace-nowrap"
      >
        + Request QR Code
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {success ? (
              <div className="rounded-2xl bg-[#EEF6F2] border border-[#D1E7DC] p-6 text-center">
                <p className="text-3xl">✅</p>
                <p className="mt-2 font-serif font-bold text-[#2E6B4F]">Request submitted!</p>
                <p className="mt-1 text-xs text-[#2E6B4F]">
                  Your QR request is pending admin approval. We&apos;ll update you soon.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8DFD1]/60 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#24211E]">Request QR Code</h3>
                    <p className="text-xs text-[#716B64]">
                      Submit a request for admin approval. Payment is due after approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-[#716B64] hover:text-[#24211E] text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                {error && (
                  <p className="rounded-xl border border-[#F7D6D6] bg-[#FDF2F2] p-2.5 text-xs font-semibold text-[#A83B3B]">
                    {error}
                  </p>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#716B64] mb-1">
                      QR Code Name / Label *
                    </label>
                    <input
                      required
                      className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                      placeholder="e.g. Table 1, Main Counter"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#716B64] mb-1">
                        Placement / Location
                      </label>
                      <input
                        className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                        placeholder="e.g. Ground Floor, Patio"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#716B64] mb-1">
                        Table Number
                      </label>
                      <input
                        className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                        placeholder="e.g. 4"
                        value={form.tableNo}
                        onChange={(e) => setForm({ ...form, tableNo: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#716B64] mb-1">
                      QR Count
                    </label>
                    <input
                      readOnly
                      className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2]/60 px-3.5 py-2 text-xs font-medium text-[#716B64]"
                      value={1}
                    />
                    <p className="mt-1 text-[11px] text-[#716B64]/70">
                      Each restaurant can have one primary QR code per request.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#716B64] mb-1">
                      Note for Admin (optional)
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] p-3 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white min-h-[72px] resize-y"
                      placeholder="Any special requirements or info…"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-[#E8DFD1]/60">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-[#E8DFD1] bg-white px-4 py-2 text-xs font-semibold text-[#24211E] hover:bg-[#FAF7F2]"
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#B58A4B] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition disabled:opacity-60"
                    disabled={busy}
                  >
                    {busy ? "Submitting…" : "Submit Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function QrRequestList({
  requests,
  allowTestPayment = false,
  paymentUnitPaise = 99900,
}: {
  requests: QrRequestItem[];
  allowTestPayment?: boolean;
  paymentUnitPaise?: number;
}) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8DFD1] bg-white p-8 text-center shadow-subtle">
        <p className="font-serif text-lg font-bold text-[#24211E]">No QR requests yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-[#716B64]">
          Submit a request using the button above. Once approved, scan the payment QR.
          The administrator will verify your payment and activate your QR.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const paidPayment = req.payments.find((p) => p.status === "PAID");
        const recordedPayment = req.payments.find((p) => p.status === "RECORDED");
        const effectiveStatus = paidPayment
          ? req.status
          : recordedPayment
            ? "RECORDED"
            : req.status;
        const statusCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.PENDING_APPROVAL;
        const activeQrs = req.qrCodes.filter((q) => q.status === "ACTIVE");

        return (
          <div
            key={req.id}
            className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-subtle flex flex-col sm:flex-row sm:items-start gap-4 hover:border-[#B58A4B] transition"
          >
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-sm text-[#24211E]">{req.name}</p>
                {req.restaurant && (
                  <span className="text-xs text-[#716B64]">{req.restaurant.name}</span>
                )}
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.className}`}
                >
                  {statusCfg.label}
                </span>
              </div>

              <p className="text-xs text-[#716B64]">
                {[
                  req.location && `Location: ${req.location}`,
                  req.tableNo && `Table: ${req.tableNo}`,
                  `Qty: ${req.quantity}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {req.note && (
                <p className="text-xs text-[#716B64] italic">Note: {req.note}</p>
              )}

              {req.status === "REJECTED" && req.rejectionReason && (
                <div className="rounded-xl bg-[#FDF2F2] border border-[#F7D6D6] p-3 text-xs text-[#A83B3B]">
                  <p className="font-semibold">Rejected – reason:</p>
                  <p className="mt-0.5">{req.rejectionReason}</p>
                </div>
              )}

              {req.status === "APPROVED_PAYMENT_DUE" && !paidPayment && !recordedPayment && activeQrs.length === 0 && (
                <div className="rounded-xl bg-[#FAF5ED] border border-[#E8D8BA] p-3 text-xs text-[#7A5826]">
                  <p className="font-bold">Approved · Payment required</p>
                  <p className="mt-0.5">
                    Scan the payment QR to pay. Your{" "}
                    {req.quantity} QR code{req.quantity > 1 ? "s" : ""} will activate
                    after the administrator verifies your payment.
                  </p>
                </div>
              )}

              {activeQrs.length > 0 && (
                <div className="rounded-xl bg-[#EEF6F2] border border-[#D1E7DC] p-3 text-xs text-[#2E6B4F]">
                  <p className="font-bold">
                    {activeQrs.length} QR code{activeQrs.length > 1 ? "s are" : " is"} ready
                  </p>
                  <Link
                    href="/dashboard/qr"
                    className="mt-1 inline-flex font-bold text-[#B58A4B] underline"
                  >
                    Preview, download, or print QR codes →
                  </Link>
                </div>
              )}

              <p className="text-[11px] text-[#716B64]/60">
                Submitted {new Date(req.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:shrink-0">
              {req.status === "APPROVED_PAYMENT_DUE" && activeQrs.length === 0 && !paidPayment && (
                <ManualPaymentForm
                  request={req}
                  allowTestPayment={allowTestPayment}
                  paymentUnitPaise={paymentUnitPaise}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
