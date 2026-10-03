"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    className: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Waiting for admin review",
  },
  APPROVED_PAYMENT_DUE: {
    label: "Approved – Payment Due",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Your request is approved. Submit your UPI or bank transfer UTR for verification.",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Request was rejected",
  },
  RECORDED: {
    label: "Payment submitted – verification pending",
    className: "bg-violet-50 text-violet-700 border-violet-200",
    description: "Your UTR was submitted and is awaiting admin verification.",
  },
  PAID: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Payment received; your QR codes are active.",
  },
  ACTIVE: {
    label: "Paid · Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Payment verified. Your QR codes are active.",
  },
};

function ManualPaymentForm({ request }: { request: QrRequestItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const recordedPayment = request.payments.find((p) => p.status === "RECORDED");
  const paidPayment = request.payments.find((p) => p.status === "PAID");

  if (paidPayment) {
    return (
      <span className="inline-flex items-center rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-0.5 text-xs font-medium">
        ✓ Payment Complete
      </span>
    );
  }

  async function submitUtr(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const reference = String(formData.get("reference") ?? "").trim();
    const method = String(formData.get("method") ?? "UPI");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/qr-requests/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrRequestId: request.id, reference, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit UTR");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (recordedPayment) {
    return (
      <div className="text-xs text-violet-700">
        UTR submitted; awaiting verification.
        {recordedPayment.reference && (
          <p className="mt-1 font-mono text-[11px]">UTR: {recordedPayment.reference}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submitUtr} className="flex flex-col gap-1.5">
        <label className="text-xs text-ink/70" htmlFor={`utr-${request.id}`}>
          Paid by UPI or bank? Enter UTR
        </label>
        <select
          id={`method-${request.id}`}
          name="method"
          defaultValue="UPI"
          className="input !py-1.5 text-xs"
        >
          <option value="UPI">UPI</option>
          <option value="BANK">Bank transfer</option>
        </select>
        <input
          id={`utr-${request.id}`}
          name="reference"
          required
          maxLength={120}
          className="input !py-1.5 text-xs"
          placeholder="UPI / bank reference"
        />
        <button type="submit" disabled={busy} className="btn-ghost !px-3 !py-1.5 text-xs">
          {busy ? "Submitting…" : "Submit UTR"}
        </button>
      </form>
      {error && <p className="text-xs text-rose-600">{error}</p>}
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
      <button onClick={() => setOpen(true)} className="btn">
        + Request QR Code
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            {success ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                <p className="text-2xl">✅</p>
                <p className="mt-2 font-semibold text-emerald-900">Request submitted!</p>
                <p className="mt-1 text-sm text-emerald-700">
                  Your QR request is pending admin approval. We'll update you soon.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">Request QR Code</h3>
                    <p className="text-xs text-ink/60">
                      Submit a request for admin approval. Payment is due after approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-ink/50 hover:text-ink text-sm"
                  >
                    ✕
                  </button>
                </div>

                {error && (
                  <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="label">QR Code Name / Label *</label>
                    <input
                      required
                      className="input"
                      placeholder="e.g. Table 1, Main Counter"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Placement / Location</label>
                      <input
                        className="input"
                        placeholder="e.g. Ground Floor, Patio"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Table Number</label>
                      <input
                        className="input"
                        placeholder="e.g. 4"
                        value={form.tableNo}
                        onChange={(e) => setForm({ ...form, tableNo: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Quantity *</label>
                    <input
                      required
                      type="number"
                      min={1}
                      max={20}
                      className="input"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: Number(e.target.value) })
                      }
                    />
                    <p className="mt-1 text-xs text-ink/50">
                      Number of QR codes to generate (max 20 per request)
                    </p>
                  </div>

                  <div>
                    <label className="label">Note for Admin (optional)</label>
                    <textarea
                      className="input min-h-[72px] resize-y"
                      placeholder="Any special requirements or info…"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn-ghost"
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={busy}>
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
}: {
  requests: QrRequestItem[];
}) {
  if (requests.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-display text-lg font-semibold">No QR requests yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink/70">
          Submit a request using the button above. Once approved, transfer payment by
          UPI or bank and submit the UTR for admin verification.
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
            className="panel p-5 flex flex-col sm:flex-row sm:items-start gap-4"
          >
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">{req.name}</p>
                {req.restaurant && (
                  <span className="text-xs text-ink/60">{req.restaurant.name}</span>
                )}
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}
                >
                  {statusCfg.label}
                </span>
              </div>

              <p className="text-sm text-ink/60">
                {[
                  req.location && `Location: ${req.location}`,
                  req.tableNo && `Table: ${req.tableNo}`,
                  `Qty: ${req.quantity}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {req.note && (
                <p className="text-xs text-ink/50 italic">Note: {req.note}</p>
              )}

              {req.status === "REJECTED" && req.rejectionReason && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  <p className="font-semibold">Rejected – reason:</p>
                  <p className="mt-0.5">{req.rejectionReason}</p>
                </div>
              )}

              {req.status === "APPROVED_PAYMENT_DUE" && !paidPayment && !recordedPayment && activeQrs.length === 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                  <p className="font-semibold">✅ Approved! Payment required</p>
                  <p className="mt-0.5">
                    Transfer payment by UPI or bank, then submit the UTR below. Your{" "}
                    {req.quantity} QR code{req.quantity > 1 ? "s" : ""} will activate
                    after admin verification.
                  </p>
                </div>
              )}

              {activeQrs.length > 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                  <p className="font-semibold">
                    🎉 {activeQrs.length} QR code{activeQrs.length > 1 ? "s" : ""} active!
                  </p>
                  <p className="mt-0.5">
                    Go to the QR codes page to download and print them.
                  </p>
                </div>
              )}

              <p className="text-xs text-ink/40">
                Submitted {new Date(req.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              {req.status === "APPROVED_PAYMENT_DUE" && activeQrs.length === 0 && !paidPayment && (
                <ManualPaymentForm request={req} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
