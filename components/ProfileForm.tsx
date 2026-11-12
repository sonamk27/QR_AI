"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessLogoInput } from "./BusinessLogoInput";

type R = {
  name: string;
  city: string | null;
  logoUrl: string | null;
  googleReviewUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  shareCaption: string | null;
};

type FirebaseSavers = {
  onSaved?: () => Promise<void> | void;
  saveIdentity?: (values: { name: string; city: string | null; logoUrl: string | null; brandColor: string }) => Promise<void>;
  saveGoogleUrl?: (url: string) => Promise<void>;
  saveSocial?: (values: { instagramUrl: string | null; facebookUrl: string | null; shareCaption: string | null }) => Promise<void>;
};

function SaveButton({ busy, label, disabled = busy }: { busy: boolean; label: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
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
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${isError
          ? "border border-[#F7D6D6] bg-[#FDF2F2] text-[#A83B3B]"
          : "border border-[#D1E7DC] bg-[#EEF6F2] text-[#2E6B4F]"
        }`}
    >
      {isError ? "⚠" : "✓"} {msg}
    </span>
  );
}

export function ProfileForm({ r, firebaseSavers }: { r: R; firebaseSavers?: FirebaseSavers }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [msgIsError, setMsgIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoValue, setLogoValue] = useState(r.logoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);

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
    if (firebaseSavers?.saveIdentity) {
      try {
        await firebaseSavers.saveIdentity({
          name: String(body.name ?? "").trim(),
          city: String(body.city ?? "").trim() || null,
          logoUrl: logoValue.trim() || null,
          brandColor: String(body.brandColor ?? ""),
        });
        await firebaseSavers.onSaved?.();
        setMsgIsError(false);
        setMsg("Changes saved!");
      } catch (error) {
        setMsgIsError(true);
        setMsg(error instanceof Error ? error.message : "Could not save.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, logoUrl: logoValue.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setMsgIsError(!res.ok);
      setMsg(res.ok ? "Changes saved!" : data.error ?? "Could not save.");
      if (res.ok) router.refresh();
    } catch {
      setMsgIsError(true);
      setMsg("Unable to reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGoogleBusinessUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGoogleBusy(true);
    setGoogleUrlError("");
    setGoogleUrlSaved("");
    try {
      if (firebaseSavers?.saveGoogleUrl) {
        await firebaseSavers.saveGoogleUrl(googleBusinessUrl.trim());
        await firebaseSavers.onSaved?.();
        setGoogleUrlSaved("URL saved!");
        router.refresh();
        return;
      }
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
      if (firebaseSavers?.saveSocial) {
        await firebaseSavers.saveSocial({
          instagramUrl: instagramUrl.trim() || null,
          facebookUrl: facebookUrl.trim() || null,
          shareCaption: shareCaption.trim() || null,
        });
        await firebaseSavers.onSaved?.();
        setSocialMsg("Social links saved!");
        router.refresh();
        return;
      }
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
      {/* ── Card 1: Business Identity ───────────────────────────── */}
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle"
      >
        <div className="flex items-center gap-3 px-6 py-4 bg-[#FAF7F2] border-b border-[#E8DFD1]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-lg text-[#B58A4B] border border-[#E8D8BA]">
            🏪
          </span>
          <div>
            <h2 className="font-serif font-bold text-sm text-[#24211E]">Business Identity</h2>
            <p className="text-xs text-[#716B64]">Name, city, logo and brand colour</p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <BusinessLogoInput
            value={logoValue}
            onChange={(value) => {
              setLogoValue(value);
              setMsg("");
            }}
            disabled={busy}
            onProcessingChange={setLogoUploading}
          />

          {/* Name + City grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#716B64] mb-1" htmlFor="name">
                Business Name
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={r.name}
                className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:bg-white"
                placeholder="Enter business name"
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
                placeholder="Enter city"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-[#E8DFD1]/60 pt-4">
            <SaveButton busy={busy} disabled={busy || logoUploading} label="Save Changes" />
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
              Paste your business&apos;s Google Maps / Business Profile URL. Customers will be directed here after their visit.
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
            Customers can follow your Instagram &amp; Facebook pages, copy their review draft, and share on social media.
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
              placeholder="Add an optional message for customers to share."
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
