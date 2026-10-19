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

export function ProfileForm({ r }: { r: R }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState(r.googleReviewUrl ?? "");
  const [googleUrlError, setGoogleUrlError] = useState("");
  const [googleUrlSaved, setGoogleUrlSaved] = useState("");

  // Social links state
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
    const res = await fetch("/api/restaurant", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? "Saved." : data.error ?? "Could not save.");
    if (res.ok) router.refresh();
  }

  async function saveGoogleBusinessUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
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
      setGoogleUrlSaved("Saved.");
      router.refresh();
    } catch {
      setGoogleUrlError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
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
      setSocialMsg("Saved.");
      router.refresh();
    } catch {
      setSocialError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setSocialBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={saveGoogleBusinessUrl} className="panel max-w-xl space-y-4 p-5">
        <div>
          <label className="label" htmlFor="googleBusinessUrl">Add Google Business Profile URL</label>
          <input
            id="googleBusinessUrl"
            name="googleBusinessUrl"
            type="url"
            required
            value={googleBusinessUrl}
            onChange={(event) => setGoogleBusinessUrl(event.target.value)}
            className="input"
            placeholder="https://www.google.com/maps/place/Restaurant+Name/..."
            aria-invalid={Boolean(googleUrlError)}
            aria-describedby="googleBusinessUrl-help"
          />
          <p id="googleBusinessUrl-help" className="mt-1 text-xs text-ink/60">
            Paste your restaurant&apos;s Google Business Profile URL. We will use this link for your restaurant profile.
          </p>
        </div>
        {googleUrlError && <p role="alert" className="text-sm text-red-700">{googleUrlError}</p>}
        <div className="flex items-center gap-3">
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save URL"}</button>
          {googleUrlSaved && <span role="status" className="text-sm">{googleUrlSaved}</span>}
        </div>
      </form>

      {/* Social links form */}
      <form onSubmit={saveSocialLinks} className="panel max-w-xl space-y-4 p-5">
        <div>
          <h2 className="label mb-3 text-base font-semibold">Social media &amp; review destinations</h2>
          <p className="mb-3 text-xs text-ink/60">
            Guests can choose to copy and post their AI review draft directly to Google, Instagram, or Facebook, and also see your links on the thank-you screen.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="instagramUrl">Instagram profile or review link</label>
          <input
            id="instagramUrl"
            type="url"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            className="input"
            placeholder="https://www.instagram.com/yourrestaurant"
          />
        </div>

        <div>
          <label className="label" htmlFor="facebookUrl">Facebook page or reviews link</label>
          <input
            id="facebookUrl"
            type="url"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            className="input"
            placeholder="https://www.facebook.com/yourrestaurant"
          />
        </div>

        <div>
          <label className="label" htmlFor="shareCaption">Caption or hashtags (optional)</label>
          <textarea
            id="shareCaption"
            value={shareCaption}
            onChange={(e) => setShareCaption(e.target.value)}
            className="input"
            rows={2}
            maxLength={500}
            placeholder="e.g. Loved our visit to @RestaurantName! #delicious #foodie"
          />
          <p className="mt-1 text-xs text-ink/60">Suggested caption shown on the review &amp; thank-you screen.</p>
        </div>

        {socialError && <p role="alert" className="text-sm text-red-700">{socialError}</p>}
        <div className="flex items-center gap-3">
          <button className="btn" disabled={socialBusy}>{socialBusy ? "Saving…" : "Save social links"}</button>
          {socialMsg && <span role="status" className="text-sm">{socialMsg}</span>}
        </div>
      </form>

      <form onSubmit={submit} className="panel max-w-xl space-y-4 p-5">
        <div><label className="label" htmlFor="name">Restaurant name</label><input id="name" name="name" required defaultValue={r.name} className="input" /></div>
        <div><label className="label" htmlFor="city">City</label><input id="city" name="city" defaultValue={r.city ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="logoUrl">Logo URL (optional)</label><input id="logoUrl" name="logoUrl" type="url" defaultValue={r.logoUrl ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="brandColor">Brand colour</label><input id="brandColor" name="brandColor" type="color" defaultValue={r.brandColor} className="h-10 w-20 rounded border border-line" /></div>
        <div className="flex items-center gap-3"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>{msg && <span role="status" className="text-sm">{msg}</span>}</div>
      </form>
    </div>
  );
}
