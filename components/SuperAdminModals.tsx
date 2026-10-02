"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RestaurantItem = {
  id: string;
  name: string;
  city: string | null;
  owner: { name: string; email: string };
};

export function CreateRestaurantModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdInfo, setCreatedInfo] = useState<{
    restaurantName: string;
    ownerName: string;
    email: string;
    pass: string;
  } | null>(null);

  const [form, setForm] = useState({
    name: "",
    city: "",
    googleReviewUrl: "",
    ownerName: "",
    ownerEmail: "",
    password: "",
    referredByName: "",
  });

  function generatePass() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let p = "Rf";
    for (let i = 0; i < 6; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm((prev) => ({ ...prev, password: p }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/super-admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create restaurant.");

      setCreatedInfo({
        restaurantName: form.name,
        ownerName: form.ownerName,
        email: data.credentials?.email || form.ownerEmail,
        pass: data.credentials?.password || form.password,
      });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  const welcomeMessage = createdInfo
    ? `Hello ${createdInfo.ownerName}! Your ReviewFlow dashboard for ${createdInfo.restaurantName} is active.\n\n` +
      `🌐 Login: ${typeof window !== "undefined" ? window.location.origin : ""}/login\n` +
      `📧 Email: ${createdInfo.email}\n` +
      `🔑 Password: ${createdInfo.pass}\n\n` +
      `Log in to view customer feedback, AI reviews, and download your printable QR code!`
    : "";

  return (
    <>
      <button
        onClick={() => {
          generatePass();
          setOpen(true);
        }}
        className="btn"
      >
        + Add Restaurant & Owner
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            {createdInfo ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                  <h3 className="font-semibold text-emerald-900">Restaurant & Owner Created!</h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    The account is ready. Send the login details to the owner below.
                  </p>
                </div>

                <div className="rounded-lg bg-paper p-4 text-xs font-mono whitespace-pre-wrap select-all border border-line">
                  {welcomeMessage}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(welcomeMessage);
                      alert("Message copied to clipboard!");
                    }}
                    className="btn flex-1 text-xs"
                  >
                    Copy Credentials Message
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(welcomeMessage)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost flex-1 text-xs text-center"
                  >
                    Share via WhatsApp
                  </a>
                  <button
                    onClick={() => {
                      setCreatedInfo(null);
                      setOpen(false);
                    }}
                    className="btn-ghost text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h3 className="text-lg font-semibold text-ink">New Restaurant & Owner</h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-ink/50 hover:text-ink text-sm"
                  >
                    ✕
                  </button>
                </div>

                {error && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label">Restaurant Name *</label>
                    <input
                      required
                      className="input"
                      placeholder="Taj Cafe"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">City</label>
                    <input
                      className="input"
                      placeholder="e.g. Pune"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Referred By (Seller)</label>
                    <input
                      className="input"
                      placeholder="e.g. Rahul Sharma"
                      value={form.referredByName}
                      onChange={(e) => setForm({ ...form, referredByName: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Google Review URL</label>
                    <input
                      className="input"
                      type="url"
                      placeholder="https://g.page/r/..."
                      value={form.googleReviewUrl}
                      onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-line">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink/60">Owner Account Details</p>
                  </div>

                  <div>
                    <label className="label">Owner Full Name *</label>
                    <input
                      required
                      className="input"
                      placeholder="Sunil Verma"
                      value={form.ownerName}
                      onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Owner Email *</label>
                    <input
                      required
                      type="email"
                      className="input"
                      placeholder="owner@example.com"
                      value={form.ownerEmail}
                      onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="label">Temporary Password *</label>
                      <button
                        type="button"
                        onClick={generatePass}
                        className="text-xs text-leaf hover:underline"
                      >
                        Regenerate
                      </button>
                    </div>
                    <input
                      required
                      className="input font-mono"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                    {busy ? "Creating…" : "Create Restaurant & Owner"}
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

export function CreateQrModal({
  restaurants,
  initialRestaurantId,
}: {
  restaurants: RestaurantItem[];
  initialRestaurantId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    restaurantId: initialRestaurantId || (restaurants[0]?.id ?? ""),
    name: "Main Billing Counter",
    location: "Counter",
    tableNo: "",
    amount: 999,
    method: "UPI" as "UPI" | "CASH" | "BANK",
    reference: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.restaurantId) {
      setError("Please select a restaurant.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/super-admin/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create QR code.");

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to activate QR code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          if (initialRestaurantId) {
            setForm((f) => ({ ...f, restaurantId: initialRestaurantId }));
          }
          setOpen(true);
        }}
        className={initialRestaurantId ? "btn-ghost !px-2.5 !py-1 text-xs" : "btn"}
      >
        {initialRestaurantId ? "+ Create QR" : "+ Create & Activate QR"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl">
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h3 className="text-lg font-semibold text-ink">Create & Activate QR Code</h3>
                  <p className="text-xs text-ink/60">Activates instantly for 365 days and logs payment.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-ink/50 hover:text-ink text-sm"
                >
                  ✕
                </button>
              </div>

              {error && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

              <div className="space-y-3">
                <div>
                  <label className="label">Restaurant *</label>
                  <select
                    required
                    className="input"
                    value={form.restaurantId}
                    onChange={(e) => setForm({ ...form, restaurantId: e.target.value })}
                  >
                    <option value="" disabled>Select a restaurant</option>
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.city ? `(${r.city})` : ""} — {r.owner.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">QR Name / Label *</label>
                    <input
                      required
                      className="input"
                      placeholder="e.g. Table 1 or Counter"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Table Number (optional)</label>
                    <input
                      className="input"
                      placeholder="e.g. 4"
                      value={form.tableNo}
                      onChange={(e) => setForm({ ...form, tableNo: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Placement Location (optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. Ground Floor, Patio, Bar"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>

                <div className="pt-2 border-t border-line">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/60">Payment Record (Direct UPI / Bank)</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Amount (₹) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      className="input"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="label">Method *</label>
                    <select
                      className="input"
                      value={form.method}
                      onChange={(e) => setForm({ ...form, method: e.target.value as any })}
                    >
                      <option value="UPI">UPI</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Reference / UTR *</label>
                    <input
                      required
                      className="input font-mono text-xs"
                      placeholder="e.g. 4291829012"
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    />
                  </div>
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
                  {busy ? "Activating…" : "Activate QR (365 Days)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function RenewQrModal({
  qrId,
  qrName,
  restaurantName,
}: {
  qrId: string;
  qrName: string;
  restaurantName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    amount: 999,
    method: "UPI" as "UPI" | "CASH" | "BANK",
    reference: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/super-admin/qr/${qrId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew",
          amount: Number(form.amount),
          method: form.method,
          reference: form.reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to renew QR.");

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to renew QR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost !px-2.5 !py-1 text-xs"
      >
        Extend (+1 yr)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h3 className="text-lg font-semibold text-ink">Extend QR Subscription</h3>
                  <p className="text-xs text-ink/60">Extends validity for 365 days and logs payment.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-ink/50 hover:text-ink text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-lg bg-paper p-3 text-xs text-ink/80">
                <p><span className="font-semibold">Restaurant:</span> {restaurantName}</p>
                <p><span className="font-semibold">QR Code:</span> {qrName}</p>
              </div>

              {error && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Amount (₹) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      className="input"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="label">Method *</label>
                    <select
                      className="input"
                      value={form.method}
                      onChange={(e) => setForm({ ...form, method: e.target.value as any })}
                    >
                      <option value="UPI">UPI</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Payment Reference / UTR *</label>
                  <input
                    required
                    className="input font-mono text-xs"
                    placeholder="e.g. UPI Ref / UTR"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
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
                  {busy ? "Extending…" : "Confirm Extension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function QrRowActions({
  qrId,
  slug,
  name,
  restaurantName,
  status,
  appUrl,
}: {
  qrId: string;
  slug: string;
  name: string;
  restaurantName: string;
  status: string;
  appUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const targetUrl = `${appUrl}/r/${slug}`;
  const downloadUrl = `${appUrl}/api/qr/${qrId}/download?format=png`;

  async function toggleStatus() {
    if (!confirm("Are you sure you want to disable this QR code?")) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(`/api/super-admin/qr/${qrId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to disable QR code.");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update QR code.");
    } finally {
      setBusy(false);
    }
  }

  const shareText = `Hi! Here is your active QR code for ${name} at ${restaurantName}.\n\n` +
    `Scan & Test: ${targetUrl}\n` +
    `Download PNG: ${downloadUrl}`;
  const canExtend = status === "ACTIVE";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canExtend && (
        <button
          onClick={async () => {
            if (!confirm("Extend this active QR by one year?")) return;
            setBusy(true);
            setActionError("");
            try {
              const response = await fetch(`/api/super-admin/qr/${qrId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "extend" }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error || "Failed to extend QR code.");
              router.refresh();
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Failed to extend QR code.");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="btn-ghost !px-2.5 !py-1 text-xs"
        >
          Extend (+1 yr)
        </button>
      )}
      {status !== "DISABLED" && (
        <button
          onClick={toggleStatus}
          disabled={busy}
          className="btn-ghost !px-2.5 !py-1 text-xs"
        >
          Disable
        </button>
      )}
      {actionError && (
        <span role="alert" className="text-xs text-rose-600">{actionError}</span>
      )}

      <a
        href={`/api/qr/${qrId}/download?format=png`}
        className="btn-ghost !px-2.5 !py-1 text-xs"
        download
        title="Download PNG"
      >
        PNG
      </a>

      <a
        href={`/api/qr/${qrId}/download?format=svg`}
        className="btn-ghost !px-2.5 !py-1 text-xs"
        download
        title="Download Vector SVG"
      >
        SVG
      </a>

      <a
        href={targetUrl}
        target="_blank"
        rel="noreferrer"
        className="btn-ghost !px-2.5 !py-1 text-xs"
        title="Preview customer scan page"
      >
        Preview
      </a>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noreferrer"
        className="btn-ghost !px-2.5 !py-1 text-xs text-leaf font-medium"
        title="Share via WhatsApp"
      >
        WhatsApp
      </a>
    </div>
  );
}
