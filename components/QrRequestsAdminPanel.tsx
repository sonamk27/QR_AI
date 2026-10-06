"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type QrRequestFull = {
  id: string;
  name: string;
  location?: string | null;
  tableNo?: string | null;
  quantity: number;
  note?: string | null;
  status: "PENDING_APPROVAL" | "APPROVED_PAYMENT_DUE" | "PAID" | "ACTIVE" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  restaurant: {
    id: string;
    name: string;
    city?: string | null;
    owner: { name: string; email: string };
  };
  qrCodes: { id: string; status: string; slug: string }[];
  payments: {
    id: string;
    status: string;
    amount: number;
    method: string;
    reference: string;
  }[];
};

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  PENDING_APPROVAL: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  APPROVED_PAYMENT_DUE: {
    label: "Approved",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PAID: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

function ApproveButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    if (!confirm("Approve this QR request?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/super-admin/qr-requests/${requestId}/approve`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      setDone(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="text-xs text-emerald-600 font-medium">✓ Approved</span>;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={approve}
        disabled={busy}
        className="btn !px-3 !py-1.5 text-xs !bg-emerald-700 hover:!bg-emerald-800"
      >
        {busy ? "Approving…" : "✓ Approve"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function RejectButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/super-admin/qr-requests/${requestId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      setDone(true);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="text-xs text-rose-600 font-medium">✗ Rejected</span>;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost !px-3 !py-1.5 text-xs !text-rose-600 !border-rose-200 hover:!border-rose-400"
      >
        ✗ Reject
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <form onSubmit={reject} className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-lg font-semibold text-ink">Reject QR Request</h3>
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

              <div>
                <label className="label">Rejection Reason *</label>
                <textarea
                  required
                  autoFocus
                  className="input min-h-[80px] resize-y"
                  placeholder="Please explain why this request is being rejected…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="mt-1 text-xs text-ink/50">
                  This reason will be shown to the restaurant owner.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-ghost"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn !bg-rose-600 hover:!bg-rose-700" disabled={busy}>
                  {busy ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmManualPaymentButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (!confirm("Confirm that you received this payment and activate the requested QR code?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/super-admin/qr-requests/${requestId}/verify-payment`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify payment");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button onClick={verify} disabled={busy} className="btn !px-3 !py-1.5 text-xs">
        {busy ? "Activating…" : "Confirm payment"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function DetailPanel({ request }: { request: QrRequestFull }) {
  const [open, setOpen] = useState(false);
  const paidPayment = request.payments.find((p) => p.status === "PAID");
  const recordedPayment = request.payments.find((p) => p.status === "RECORDED");
  const activeQrs = request.qrCodes.filter((q) => q.status === "ACTIVE");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost !px-2.5 !py-1 text-xs"
      >
        Details
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-semibold text-ink">Request Detail</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink/50 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-ink/50 uppercase tracking-wider">Restaurant</p>
                  <p className="font-medium">{request.restaurant.name}</p>
                  <p className="text-xs text-ink/60">{request.restaurant.city}</p>
                </div>
                <div>
                  <p className="text-xs text-ink/50 uppercase tracking-wider">Owner</p>
                  <p className="font-medium">{request.restaurant.owner.name}</p>
                  <p className="text-xs text-ink/60">{request.restaurant.owner.email}</p>
                </div>
                <div>
                  <p className="text-xs text-ink/50 uppercase tracking-wider">QR Name</p>
                  <p className="font-medium">{request.name}</p>
                </div>
                <div>
                  <p className="text-xs text-ink/50 uppercase tracking-wider">Quantity</p>
                  <p className="font-medium">{request.quantity}</p>
                </div>
                {request.location && (
                  <div>
                    <p className="text-xs text-ink/50 uppercase tracking-wider">Location</p>
                    <p className="font-medium">{request.location}</p>
                  </div>
                )}
                {request.tableNo && (
                  <div>
                    <p className="text-xs text-ink/50 uppercase tracking-wider">Table No</p>
                    <p className="font-medium">{request.tableNo}</p>
                  </div>
                )}
              </div>

              {request.note && (
                <div className="rounded-lg bg-paper p-3">
                  <p className="text-xs text-ink/50 uppercase tracking-wider mb-1">Note from restaurant</p>
                  <p className="text-sm">{request.note}</p>
                </div>
              )}

              {paidPayment && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">Payment</p>
                  <p className="text-emerald-900">
                    ₹{(paidPayment.amount / 100).toLocaleString("en-IN")} – PAID
                  </p>
                </div>
              )}

              {recordedPayment && (
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-3">
                  <p className="text-xs font-semibold text-violet-800 uppercase tracking-wider mb-1">
                    Manual payment awaiting verification
                  </p>
                  <p className="text-violet-900">
                    ₹{(recordedPayment.amount / 100).toLocaleString("en-IN")} · {recordedPayment.method}
                  </p>
                  <p className="mt-1 font-mono text-xs text-violet-800">
                    UTR: {recordedPayment.reference}
                  </p>
                </div>
              )}

              {activeQrs.length > 0 && (
                <div className="rounded-lg bg-paper p-3">
                  <p className="text-xs text-ink/50 uppercase tracking-wider mb-2">
                    Active QR Codes ({activeQrs.length})
                  </p>
                  <div className="space-y-1">
                    {activeQrs.map((q) => (
                      <p key={q.id} className="font-mono text-xs text-ink/70">
                        /r/{q.slug}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {request.rejectionReason && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                  <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-rose-900">{request.rejectionReason}</p>
                </div>
              )}

              <div className="text-xs text-ink/40">
                Submitted: {new Date(request.createdAt).toLocaleString("en-IN")}
                {request.reviewedAt && (
                  <> · Reviewed: {new Date(request.reviewedAt).toLocaleString("en-IN")}</>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-line flex justify-end">
              <button onClick={() => setOpen(false)} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function QrRequestsAdminPanel({
  requests,
  filter,
}: {
  requests: QrRequestFull[];
  filter: "all" | "PENDING_APPROVAL" | "APPROVED_PAYMENT_DUE" | "REJECTED";
}) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>(filter);

  const filtered =
    activeFilter === "all"
      ? requests
      : requests.filter((r) =>
          activeFilter === "APPROVED_PAYMENT_DUE"
            ? ["APPROVED_PAYMENT_DUE", "PAID", "ACTIVE"].includes(r.status)
            : r.status === activeFilter,
        );

  const counts = {
    all: requests.length,
    PENDING_APPROVAL: requests.filter((r) => r.status === "PENDING_APPROVAL").length,
    APPROVED_PAYMENT_DUE: requests.filter(
      (r) => r.status === "APPROVED_PAYMENT_DUE",
    ).length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: `All (${counts.all})` },
          {
            key: "PENDING_APPROVAL",
            label: `Pending (${counts.PENDING_APPROVAL})`,
            badge: counts.PENDING_APPROVAL > 0,
          },
          {
            key: "APPROVED_PAYMENT_DUE",
            label: `Payment due (${counts.APPROVED_PAYMENT_DUE})`,
          },
          { key: "REJECTED", label: `Rejected (${counts.REJECTED})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeFilter === tab.key
                ? "bg-ink text-white"
                : "bg-paper border border-line text-ink hover:bg-white"
            }`}
          >
            {tab.label}
            {tab.badge && activeFilter !== tab.key && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500" />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className="th">Restaurant</th>
              <th className="th">QR Name</th>
              <th className="th">Qty</th>
              <th className="th">Status</th>
              <th className="th">Payment</th>
              <th className="th">Submitted</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="td text-center text-ink/60 py-8">
                  No requests found for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status];
                const paidPayment = req.payments.find((p) => p.status === "PAID");
                const recordedPayment = req.payments.find((p) => p.status === "RECORDED");
                const pendingPayment = req.payments.find((p) => p.status === "PENDING");
                const activeQrs = req.qrCodes.filter((q) => q.status === "ACTIVE");

                return (
                  <tr key={req.id}>
                    <td className="td">
                      <p className="font-medium text-ink">{req.restaurant.name}</p>
                      <p className="text-xs text-ink/60">{req.restaurant.owner.email}</p>
                    </td>
                    <td className="td">
                      <p className="font-medium">{req.name}</p>
                      {req.location && (
                        <p className="text-xs text-ink/60">{req.location}</p>
                      )}
                    </td>
                    <td className="td font-medium text-center">{req.quantity}</td>
                    <td className="td">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
                      >
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="td text-xs">
                      {paidPayment ? (
                        <span className="text-emerald-700 font-medium">
                          ₹{(paidPayment.amount / 100).toLocaleString("en-IN")} paid
                          {activeQrs.length > 0 && ` · ${activeQrs.length} QR active`}
                        </span>
                      ) : pendingPayment ? (
                        <span className="text-amber-600">Awaiting payment</span>
                      ) : recordedPayment ? (
                        <span className="text-violet-700">
                          ₹{(recordedPayment.amount / 100).toLocaleString("en-IN")} · awaiting verification
                        </span>
                      ) : (
                        <span className="text-ink/40">—</span>
                      )}
                    </td>
                    <td className="td text-sm">
                      {new Date(req.createdAt).toLocaleDateString("en-IN", {
                        dateStyle: "medium",
                      })}
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <DetailPanel request={req} />
                        {req.status === "APPROVED_PAYMENT_DUE" && !paidPayment && (
                          <ConfirmManualPaymentButton requestId={req.id} />
                        )}
                        {req.status === "PENDING_APPROVAL" && (
                          <>
                            <ApproveButton requestId={req.id} />
                            <RejectButton requestId={req.id} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
