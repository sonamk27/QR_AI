"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type R = { name: string; city: string | null; logoUrl: string | null; brandColor: string; googleReviewUrl: string | null };

export function ProfileForm({ r }: { r: R }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <form onSubmit={submit} className="panel max-w-xl space-y-4 p-5">
      <div><label className="label" htmlFor="name">Restaurant name</label><input id="name" name="name" required defaultValue={r.name} className="input" /></div>
      <div><label className="label" htmlFor="city">City</label><input id="city" name="city" defaultValue={r.city ?? ""} className="input" /></div>
      <div>
        <label className="label" htmlFor="googleReviewUrl">Google review link</label>
        <input id="googleReviewUrl" name="googleReviewUrl" type="url" defaultValue={r.googleReviewUrl ?? ""} className="input" placeholder="https://search.google.com/local/writereview?placeid=…" />
        <p className="mt-1 text-xs text-ink/60">Guests land here after tapping “Continue to Google”. Use the link from your Google Business Profile.</p>
      </div>
      <div><label className="label" htmlFor="logoUrl">Logo URL (optional)</label><input id="logoUrl" name="logoUrl" type="url" defaultValue={r.logoUrl ?? ""} className="input" /></div>
      <div><label className="label" htmlFor="brandColor">Brand colour</label><input id="brandColor" name="brandColor" type="color" defaultValue={r.brandColor} className="h-10 w-20 rounded border border-line" /></div>
      <div className="flex items-center gap-3"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>{msg && <span role="status" className="text-sm">{msg}</span>}</div>
    </form>
  );
}
