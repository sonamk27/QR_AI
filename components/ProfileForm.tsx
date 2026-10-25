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
      className="inline-flex items-center gap-2 rounded-xl bg-[#B58A4B] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] disabled:opacity-60"
    >
      {busy && (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        isError
          ? "border border-[#F7D6D6] bg-[#FDF2F2] text-[#A83B3B]"
          : "border border-[#D1E7DC] bg-[#EEF6F2] text-[#2E6B4F]"
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
        className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle"
      >
        <div className="flex items-center gap-3 px-6 py-4 bg-[#FAF7F2] border-b border-[#E8DFD1]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
            🏪
          </span>
          <div>
            <h2 className="font-serif font-bold text-sm text-[#24211E]">Restaurant Identity</h2>
            <p className="text-xs text-[#716B64]">Name, city, logo and brand colour</p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {/* Logo preview + URL */}
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  onError={() => setLogoPreview("")}
                  className="h-16 w-16 rounded-xl object-cover ring-2 ring-[#E8DFD1]"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#FAF7F2] ring-2 ring-dashed ring-[#E8DFD1] text-2xl">
                  🖼
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="logoUrl">
                Logo URL <span className="font-normal text-[#716B64]/60">(optional)</span>
              </label>
              <input
                id="logoUrl"
                name="logoUrl"
                type="url"
                defaultValue={r.logoUrl ?? ""}
                className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                placeholder="https://example.com/logo.png"
                onChange={(e) => setLogoPreview(e.target.value)}
              />
            </div>
          </div>

          {/* Name + City grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="name">
                Restaurant Name
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={r.name}
                className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                placeholder="The Daily Brew"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="city">
                City
              </label>
              <input
                id="city"
                name="city"
                defaultValue={r.city ?? ""}
                className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                placeholder="Mumbai"
              />
            </div>
          </div>

          {/* Brand colour */}
          <div>
            <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="brandColor">
              Brand Accent Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                id="brandColor"
                name="brandColor"
                type="color"
                defaultValue={r.brandColor || "#B58A4B"}
                className="h-10 w-14 cursor-pointer rounded-xl border border-[#E8DFD1] p-0.5 bg-white"
              />
              <span className="text-xs text-[#716B64]">Used as the accent colour across your loyalty cards</span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-[#E8DFD1]/60 pt-4">
            <SaveButton busy={busy} label="Save Changes" />
            <StatusBadge msg={msg} isError={msgIsError} />
          </div>
        </div>
      </form>

      {/* ── Card 2: Google Reviews ─────────────────────────────── */}
      <form
        onSubmit={saveGoogleBusinessUrl}
        className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle"
      >
        <div className="flex items-center gap-3 px-6 py-4 bg-[#FAF7F2] border-b border-[#E8DFD1]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
            ⭐
          </span>
          <div>
            <h2 className="font-serif font-bold text-sm text-[#24211E]">Google Reviews</h2>
            <p className="text-xs text-[#716B64]">Drive more reviews with a direct link</p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="googleBusinessUrl">
              Google Business Profile URL
            </label>
            <input
              id="googleBusinessUrl"
              name="googleBusinessUrl"
              type="url"
              required
              value={googleBusinessUrl}
              onChange={(event) => setGoogleBusinessUrl(event.target.value)}
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
              placeholder="https://www.google.com/maps/place/..."
              aria-invalid={Boolean(googleUrlError)}
              aria-describedby="googleBusinessUrl-help"
            />
            <p id="googleBusinessUrl-help" className="mt-1.5 text-xs text-[#716B64]">
              Paste your restaurant&apos;s Google Maps / Business Profile URL. Customers will be directed here after their visit.
            </p>
          </div>
          {googleUrlError && <p role="alert" className="text-xs font-semibold text-[#A83B3B]">{googleUrlError}</p>}
          <div className="flex items-center gap-3 border-t border-[#E8DFD1]/60 pt-4">
            <SaveButton busy={googleBusy} label="Save URL" />
            <StatusBadge msg={googleUrlSaved} isError={false} />
          </div>
        </div>
      </form>

      {/* ── Card 3: Social & Sharing ───────────────────────────── */}
      <form
        onSubmit={saveSocialLinks}
        className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle"
      >
        <div className="flex items-center gap-3 px-6 py-4 bg-[#FAF7F2] border-b border-[#E8DFD1]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
            📣
          </span>
          <div>
            <h2 className="font-serif font-bold text-sm text-[#24211E]">Social &amp; Sharing</h2>
            <p className="text-xs text-[#716B64]">Help guests follow you and share their experience</p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-xs text-[#716B64]">
            Guests can follow your Instagram &amp; Facebook pages, copy their AI review draft, and share on social media.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="instagramUrl">
                Instagram URL
              </label>
              <input
                id="instagramUrl"
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                placeholder="https://www.instagram.com/yourrestaurant"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="facebookUrl">
                Facebook URL
              </label>
              <input
                id="facebookUrl"
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                placeholder="https://www.facebook.com/yourrestaurant"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="shareCaption">
              Caption, hashtags or offer text <span className="font-normal text-[#716B64]/60">(optional)</span>
            </label>
            <textarea
              id="shareCaption"
              value={shareCaption}
              onChange={(e) => setShareCaption(e.target.value)}
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] p-3 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
              rows={2}
              maxLength={500}
              placeholder="e.g. Follow us & tag @Restaurant to get featured in our stories!"
            />
          </div>

          {socialError && <p role="alert" className="text-xs font-semibold text-[#A83B3B]">{socialError}</p>}
          <div className="flex items-center gap-3 border-t border-[#E8DFD1]/60 pt-4">
            <SaveButton busy={socialBusy} label="Save Social Links" />
            <StatusBadge msg={socialMsg} isError={false} />
          </div>
        </div>
      </form>
    </div>
  );
}
