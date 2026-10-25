"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type R = {
  name: string;
  city: string | null;
  logoUrl: string | null;
  brandColor: string;
  googleReviewUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  shareCaption: string | null;
};

function SaveButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      style={{
        background: busy
          ? "#a5b4fc"
          : "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
      }}
      className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed"
    >
      {busy && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      )}
      {busy ? "Saving…" : label}
    </button>
  );
}

function StatusBadge({ msg, isError }: { msg: string; isError?: boolean }) {
  if (!msg) return null;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
        isError
          ? "bg-red-50 text-red-700 ring-red-200"
          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
      }`}
    >
      {isError ? "⚠" : "✓"} {msg}
    </span>
  );
}

export function ProfileForm({ r }: { r: R }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [msgIsError, setMsgIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoPreview, setLogoPreview] = useState(r.logoUrl ?? "");

  const [googleBusinessUrl, setGoogleBusinessUrl] = useState(r.googleReviewUrl ?? "");
  const [googleUrlError, setGoogleUrlError] = useState("");
  const [googleUrlSaved, setGoogleUrlSaved] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const [instagramUrl, setInstagramUrl] = useState(r.instagramUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(r.facebookUrl ?? "");
  const [shareCaption, setShareCaption] = useState(r.shareCaption ?? "");
  const [socialMsg, setSocialMsg] = useState("");
  const [socialError, setSocialError] = useState("");
  const [socialBusy, setSocialBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch("/api/restaurant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsgIsError(!res.ok);
    setMsg(res.ok ? "Changes saved!" : data.error ?? "Could not save.");
    if (res.ok) router.refresh();
  }

  async function saveGoogleBusinessUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGoogleBusy(true);
    setGoogleUrlError("");
    setGoogleUrlSaved("");
    try {
      const response = await fetch("/api/restaurant/google-business-url", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleBusinessUrl }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGoogleUrlError(data.error ?? "Could not save the URL.");
        return;
      }
      setGoogleUrlSaved("URL saved!");
      router.refresh();
    } catch {
      setGoogleUrlError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function saveSocialLinks(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSocialBusy(true);
    setSocialError("");
    setSocialMsg("");
    try {
      const response = await fetch("/api/restaurant/social-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUrl, facebookUrl, shareCaption }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSocialError(data.error ?? "Could not save social links.");
        return;
      }
      setSocialMsg("Social links saved!");
      router.refresh();
    } catch {
      setSocialError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setSocialBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">

      {/* ── Card 1: Restaurant Identity ──────────────────────────── */}
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
      >
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{
            background: "linear-gradient(135deg,rgba(99,102,241,.08) 0%,rgba(139,92,246,.08) 100%)",
            borderBottom: "1px solid var(--color-line,#e5e7eb)",
          }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-lg">🏪</span>
          <div>
            <h2 className="font-semibold text-ink">Restaurant Identity</h2>
            <p className="text-xs text-ink/50">Name, city, logo and brand colour</p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {/* Logo preview + URL */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  onError={() => setLogoPreview("")}
                  className="h-16 w-16 rounded-xl object-cover ring-2 ring-line"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-ink/5 ring-2 ring-dashed ring-line text-2xl">
                  🖼
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="logoUrl">
                Logo URL <span className="font-normal text-ink/40">(optional)</span>
              </label>
              <input
                id="logoUrl"
                name="logoUrl"
                type="url"
                defaultValue={r.logoUrl ?? ""}
                className="input mt-1"
                placeholder="https://example.com/logo.png"
                onChange={(e) => setLogoPreview(e.target.value)}
              />
            </div>
          </div>

          {/* Name + City grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Restaurant Name</label>
              <input id="name" name="name" required defaultValue={r.name} className="input mt-1" placeholder="My Restaurant" />
            </div>
            <div>
              <label className="label" htmlFor="city">City</label>
              <input id="city" name="city" defaultValue={r.city ?? ""} className="input mt-1" placeholder="New York" />
            </div>
          </div>

          {/* Brand colour */}
          <div>
            <label className="label" htmlFor="brandColor">Brand Colour</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id="brandColor"
                name="brandColor"
                type="color"
                defaultValue={r.brandColor}
                className="h-10 w-14 cursor-pointer rounded-lg border border-line p-0.5"
              />
              <span className="text-xs text-ink/50">Used as the accent colour across your loyalty experience</span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-line pt-4">
            <SaveButton busy={busy} label="Save Changes" />
            <StatusBadge msg={msg} isError={msgIsError} />
          </div>
        </div>
      </form>

      {/* ── Card 2: Google Reviews ─────────────────────────────── */}
      <form
        onSubmit={saveGoogleBusinessUrl}
        className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
      >
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{
            background: "linear-gradient(135deg,rgba(59,130,246,.08) 0%,rgba(16,185,129,.08) 100%)",
            borderBottom: "1px solid var(--color-line,#e5e7eb)",
          }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-lg">⭐</span>
          <div>
            <h2 className="font-semibold text-ink">Google Reviews</h2>
            <p className="text-xs text-ink/50">Drive more reviews with a direct link</p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="label" htmlFor="googleBusinessUrl">Google Business Profile URL</label>
            <input
              id="googleBusinessUrl"
              name="googleBusinessUrl"
              type="url"
              required
              value={googleBusinessUrl}
              onChange={(event) => setGoogleBusinessUrl(event.target.value)}
              className="input mt-1"
              placeholder="https://www.google.com/maps/place/Restaurant+Name/..."
              aria-invalid={Boolean(googleUrlError)}
              aria-describedby="googleBusinessUrl-help"
            />
            <p id="googleBusinessUrl-help" className="mt-1.5 text-xs text-ink/50">
              Paste your restaurant&apos;s Google Maps / Business Profile URL. Customers will be directed here after their visit.
            </p>
          </div>
          {googleUrlError && <p role="alert" className="text-sm text-red-600">{googleUrlError}</p>}
          <div className="flex items-center gap-3 border-t border-line pt-4">
            <SaveButton busy={googleBusy} label="Save URL" />
            <StatusBadge msg={googleUrlSaved} isError={false} />
          </div>
        </div>
      </form>

      {/* ── Card 3: Social & Sharing ───────────────────────────── */}
      <form
        onSubmit={saveSocialLinks}
        className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
      >
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{
            background: "linear-gradient(135deg,rgba(236,72,153,.08) 0%,rgba(239,68,68,.08) 100%)",
            borderBottom: "1px solid var(--color-line,#e5e7eb)",
          }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-lg">📣</span>
          <div>
            <h2 className="font-semibold text-ink">Social &amp; Sharing</h2>
            <p className="text-xs text-ink/50">Help guests follow you and share their experience</p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-xs text-ink/60">
            Guests can follow your Instagram &amp; Facebook pages, copy their AI review draft with your @tag pre-filled, and share their experience on social media.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="instagramUrl">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  Instagram URL
                </span>
              </label>
              <input
                id="instagramUrl"
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="input mt-1"
                placeholder="https://www.instagram.com/yourrestaurant"
              />
              <p className="mt-1 text-xs text-ink/50">Used for &quot;Follow on Instagram&quot; and table tent QR cards.</p>
            </div>

            <div>
              <label className="label" htmlFor="facebookUrl">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook URL
                </span>
              </label>
              <input
                id="facebookUrl"
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className="input mt-1"
                placeholder="https://www.facebook.com/yourrestaurant"
              />
              <p className="mt-1 text-xs text-ink/50">Used for &quot;Follow on Facebook&quot; and table tent QR cards.</p>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="shareCaption">
              Caption, hashtags or offer text{" "}
              <span className="font-normal text-ink/40">(optional)</span>
            </label>
            <textarea
              id="shareCaption"
              value={shareCaption}
              onChange={(e) => setShareCaption(e.target.value)}
              className="input mt-1"
              rows={2}
              maxLength={500}
              placeholder="e.g. Follow us & tag @Restaurant to get featured in our stories!"
            />
            <p className="mt-1 text-xs text-ink/50">
              Appended to the customer review draft and shown on thank-you screen and table stands.{" "}
              <span className={shareCaption.length > 450 ? "font-semibold text-amber-600" : ""}>
                ({shareCaption.length}/500)
              </span>
            </p>
          </div>

          {socialError && <p role="alert" className="text-sm text-red-600">{socialError}</p>}
          <div className="flex items-center gap-3 border-t border-line pt-4">
            <SaveButton busy={socialBusy} label="Save Social Links" />
            <StatusBadge msg={socialMsg} isError={false} />
          </div>
        </div>
      </form>
    </div>
  );
}
