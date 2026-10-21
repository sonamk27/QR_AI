"use client";

import { useEffect, useRef, useState } from "react";
import { Stars } from "./Stars";
import { extractSocialHandle, formatReviewWithTag, getSocialFollowUrls } from "@/lib/social-format";

type Rec = { stop: () => void };

export function Flow({
  slug,
  restaurantId,
  name,
  logoUrl,
  color,
  googleReviewUrl,
  instagramUrl: initialInstagramUrl,
  facebookUrl: initialFacebookUrl,
  shareCaption: initialShareCaption,
}: {
  slug: string;
  restaurantId: string;
  name: string;
  logoUrl: string | null;
  color: string;
  googleReviewUrl?: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  shareCaption: string | null;
}) {
  const [step, setStep] = useState(0);
  const [overall, setOverall] = useState(0);
  const [food, setFood] = useState(0);
  const [service, setService] = useState(0);
  const [details, setDetails] = useState("");
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [googleUrl, setGoogleUrl] = useState<string | null>(googleReviewUrl ?? null);
  const [instagramUrl, setInstagramUrl] = useState<string | null>(initialInstagramUrl ?? null);
  const [facebookUrl, setFacebookUrl] = useState<string | null>(initialFacebookUrl ?? null);
  const [shareCaption, setShareCaption] = useState<string | null>(initialShareCaption ?? null);
  const [draftVariantIndex, setDraftVariantIndex] = useState(1);
  const [busy, setBusy] = useState(false);
  const [copyingPlatform, setCopyingPlatform] = useState<string | null>(null);
  const [lastPlatform, setLastPlatform] = useState<"google" | "instagram" | "facebook" | null>(null);
  const [googlePosted, setGooglePosted] = useState(false);
  const [copiedOnly, setCopiedOnly] = useState(false);
  const [copiedTagged, setCopiedTagged] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);

  const igHandle = extractSocialHandle(instagramUrl, "instagram");
  const fbHandle = extractSocialHandle(facebookUrl, "facebook");

  useEffect(() => {
    fetch(`/api/public/${slug}/scan`, { method: "POST" }).catch(() => {});
  }, [slug]);

  function rate(setter: (rating: number) => void) {
    return (rating: number) => {
      setter(rating);
      setError("");
      setTimeout(() => setStep((current) => current + 1), 250);
    };
  }

  async function generateReview(regenerate = false) {
    const variants = ["casual", "short", "detailed"] as const;
    const variant = regenerate
      ? variants[draftVariantIndex % variants.length]
      : variants[0];
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          sessionId: regenerate ? sessionId : undefined,
          overall,
          food,
          service,
          chips: [],
          text: details.trim() || undefined,
          variant,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not generate a review draft. Please try again.");
      }
      setSessionId(data.sessionId);
      if (data.googleUrl !== undefined) setGoogleUrl(data.googleUrl);
      if (data.instagramUrl !== undefined) setInstagramUrl(data.instagramUrl);
      if (data.facebookUrl !== undefined) setFacebookUrl(data.facebookUrl);
      if (data.shareCaption !== undefined) setShareCaption(data.shareCaption);
      setDraft(data.text);
      if (regenerate) {
        setDraftVariantIndex((index) => index + 1);
      }
      setStep(4);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate a review draft. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function trackClick() {
    if (!sessionId) return;
    navigator.sendBeacon?.(
      "/api/public/google-click",
      new Blob(
        [JSON.stringify({ sessionId, editedText: draft })],
        { type: "application/json" },
      ),
    );
  }

  function trackSocialClick(platform: "instagram" | "facebook") {
    navigator.sendBeacon?.(
      "/api/public/social-click",
      new Blob(
        [JSON.stringify({ restaurantId, platform, sessionId })],
        { type: "application/json" },
      ),
    );
  }

  async function copyAndContinue(platform: "google" | "instagram" | "facebook") {
    let url: string | null = null;
    let textToCopy = draft;

    if (platform === "google") {
      url = googleUrl;
    } else if (platform === "instagram") {
      const igLinks = getSocialFollowUrls(instagramUrl, "instagram");
      url = igLinks?.webUrl ?? instagramUrl;
      textToCopy = formatReviewWithTag(draft, name, igHandle, shareCaption);
    } else if (platform === "facebook") {
      const fbLinks = getSocialFollowUrls(facebookUrl, "facebook");
      url = fbLinks?.webUrl ?? facebookUrl;
      textToCopy = formatReviewWithTag(draft, name, fbHandle, shareCaption);
    }

    if (!url) return;

    setCopyingPlatform(platform);
    setError("");
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      setError("Could not copy your review. Please allow clipboard access and try again.");
      setCopyingPlatform(null);
      return;
    }

    if (platform === "google") {
      trackClick();
      setGooglePosted(true);
    } else {
      trackSocialClick(platform);
    }

    setLastPlatform(platform);
    setStep(5);
    setCopyingPlatform(null);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyOnly() {
    setError("");
    try {
      await navigator.clipboard.writeText(draft);
      setCopiedOnly(true);
      setTimeout(() => setCopiedOnly(false), 3000);
    } catch {
      setError("Could not copy review text. Please select and copy manually.");
    }
  }

  async function copyTaggedReview() {
    setError("");
    try {
      const textToCopy = formatReviewWithTag(draft, name, igHandle || fbHandle, shareCaption);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedTagged(true);
      setTimeout(() => setCopiedTagged(false), 3000);
    } catch {
      setError("Could not copy review text.");
    }
  }

  function voice() {
    type SR = {
      lang: string;
      interimResults: boolean;
      onresult: (event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: new () => SR;
      webkitSpeechRecognition?: new () => SR;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input is not supported on this browser. You can type instead.");
      return;
    }
    if (listening) {
      rec.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) =>
      setDetails((current) => `${current} ${event.results[0][0].transcript}`.trim());
    recognition.onend = () => setListening(false);
    rec.current = recognition;
    setListening(true);
    recognition.start();
  }

  const accent = { backgroundColor: color };
  const progress = step < 3 ? ((step + 1) / 4) * 100 : step === 3 ? 85 : 100;
  const hasAnyReviewLink = Boolean(googleUrl || instagramUrl || facebookUrl);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="text-center">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="mx-auto mb-2 h-14 w-14 rounded-full object-cover"
          />
        )}
        <p className="font-display text-xl font-semibold">{name}</p>
        <div
          className="mx-auto mt-3 h-1 w-24 overflow-hidden rounded bg-line"
          aria-label={`Progress ${progress}%`}
        >
          <div className="h-1 transition-all" style={{ ...accent, width: `${progress}%` }} />
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-8">
        {step === 0 && (
          <>
            <h1 className="text-center text-3xl font-semibold">How was your visit?</h1>
            <p className="text-center text-sm text-ink/70">
              First, rate your overall experience.
            </p>
            <Stars value={overall} onChange={rate(setOverall)} label="Overall experience rating" />
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-center text-3xl font-semibold">How was the food?</h1>
            <p className="text-center text-sm text-ink/70">
              Rate the food based on your experience.
            </p>
            <Stars value={food} onChange={rate(setFood)} label="Food rating" />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-center text-3xl font-semibold">How was the service?</h1>
            <p className="text-center text-sm text-ink/70">
              Rate the service you received.
            </p>
            <Stars value={service} onChange={rate(setService)} label="Service rating" />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-center text-3xl font-semibold">Anything else to mention?</h1>
            <p className="text-center text-sm text-ink/70">
              Add a detail in your own words. This is optional and helps make your draft personal.
            </p>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={600}
              rows={4}
              className="input"
              placeholder="A dish you liked, something that stood out, or what could be better."
              aria-label="Additional comments"
            />
            <button type="button" className="btn-ghost" onClick={voice}>
              {listening ? "Stop listening" : "Speak instead"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => generateReview()}
              disabled={busy}
              style={accent}
            >
              {busy ? "Writing your draft…" : "Generate my review draft"}
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-center text-3xl font-semibold">Your review draft</h1>
            <p className="text-center text-sm text-ink/70">
              Review and edit this draft so it sounds like you. Nothing is posted without your action.
            </p>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              rows={6}
              className="input"
              aria-label="Edit your review draft"
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => generateReview(true)}
              disabled={busy || Boolean(copyingPlatform)}
            >
              {busy ? "Regenerating…" : "Generate another draft"}
            </button>

            {hasAnyReviewLink ? (
              <div className="space-y-3 pt-2">
                <p className="text-center text-xs font-semibold uppercase tracking-wider text-ink/60">
                  Choose where to review &amp; follow
                </p>

                <div className="flex flex-col gap-2.5">
                  {/* Google Reviews */}
                  {googleUrl && (
                    <button
                      type="button"
                      onClick={() => copyAndContinue("google")}
                      disabled={busy || Boolean(copyingPlatform)}
                      className="flex w-full items-center justify-between rounded-xl border border-line bg-white p-3.5 text-left font-medium text-ink shadow-sm transition hover:border-ink/25 hover:bg-paper active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                          {/* Google G icon */}
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                              fill="#EA4335"
                              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                            />
                            <path
                              fill="#4285F4"
                              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.6C3.7 20.4 7.5 23.2 12 23.2z"
                            />
                          </svg>
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-ink">Review on Google</div>
                          <div className="text-xs text-ink/60">Copies review &amp; opens Google Maps</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-ink/80">
                        {copyingPlatform === "google" ? "Opening…" : "Post →"}
                      </span>
                    </button>
                  )}

                  {/* Instagram Follow & Review */}
                  {instagramUrl && (
                    <button
                      type="button"
                      onClick={() => copyAndContinue("instagram")}
                      disabled={busy || Boolean(copyingPlatform)}
                      className="flex w-full items-center justify-between rounded-xl border border-pink-200 bg-white p-3.5 text-left font-medium text-ink shadow-sm transition hover:border-pink-400 hover:bg-pink-50/30 active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                          {/* Instagram SVG icon */}
                          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                          </svg>
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-ink">
                            Follow &amp; Review on Instagram
                          </div>
                          <div className="text-xs text-ink/60">
                            Copies review with @tag &amp; opens Instagram
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-pink-600">
                        {copyingPlatform === "instagram" ? "Opening…" : "Follow & Tag →"}
                      </span>
                    </button>
                  )}

                  {/* Facebook Follow & Review */}
                  {facebookUrl && (
                    <button
                      type="button"
                      onClick={() => copyAndContinue("facebook")}
                      disabled={busy || Boolean(copyingPlatform)}
                      className="flex w-full items-center justify-between rounded-xl border border-blue-200 bg-white p-3.5 text-left font-medium text-ink shadow-sm transition hover:border-blue-400 hover:bg-blue-50/30 active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          {/* Facebook SVG icon */}
                          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                          </svg>
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-ink">
                            Follow &amp; Review on Facebook
                          </div>
                          <div className="text-xs text-ink/60">
                            Copies review &amp; opens Facebook page
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-blue-600">
                        {copyingPlatform === "facebook" ? "Opening…" : "Follow & Post →"}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={copyOnly}
                    className="inline-flex items-center gap-1.5 text-xs text-ink/70 hover:text-ink underline"
                  >
                    {copiedOnly ? "✓ Review copied to clipboard!" : "Just copy text to clipboard"}
                  </button>
                </div>

                {/* Direct social profile quick-access (no review needed) */}
                {(instagramUrl || facebookUrl) && (
                  <div className="rounded-xl border border-line bg-paper p-3 space-y-2">
                    <p className="text-center text-[10px] font-bold uppercase tracking-wider text-ink/40">
                      Or follow us directly
                    </p>
                    <div className="flex gap-2">
                      {instagramUrl && (
                        <a
                          href={instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackSocialClick("instagram")}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-pink-600 py-2.5 text-xs font-bold text-white hover:bg-pink-700 transition active:scale-[0.99]"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current shrink-0">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                          </svg>
                          <span>{igHandle || "Instagram"} ↗</span>
                        </a>
                      )}
                      {facebookUrl && (
                        <a
                          href={facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackSocialClick("facebook")}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition active:scale-[0.99]"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current shrink-0">
                            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                          </svg>
                          <span>{fbHandle || "Facebook"} ↗</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2 text-center">
                <button
                  type="button"
                  onClick={copyOnly}
                  className="btn w-full"
                  style={accent}
                >
                  {copiedOnly ? "✓ Copied to clipboard!" : "Copy review draft"}
                </button>
                <p className="text-xs text-ink/60">
                  Review links haven&apos;t been set up yet. You can copy your review above.
                </p>
              </div>
            )}

            <p className="text-center text-xs text-ink/50">
              Your draft is automatically copied to your clipboard when you select a platform. You choose what to post.
            </p>
          </>
        )}

        {step === 5 && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-5xl">🎉</span>
              <h1 className="text-3xl font-semibold">Thank you!</h1>
              <p className="text-sm text-ink/70">
                {lastPlatform === "google"
                  ? "Your review draft was copied! Paste it into Google Maps and tap Post — it means the world to us."
                  : lastPlatform === "instagram"
                  ? "Your review draft was copied with our tag! Paste it into your Instagram Story or post."
                  : lastPlatform === "facebook"
                  ? "Your review draft was copied! Paste it into Facebook to recommend us."
                  : "Your review draft was copied to your clipboard. Thank you for your feedback!"}
              </p>
            </div>

            {/* Follow & Review Rewards / Shoutouts Panel */}
            <div className="rounded-2xl border border-line bg-paper p-5 text-center space-y-4 shadow-sm">
              <div>
                <p className="text-sm font-bold text-ink">
                  Follow us for special offers &amp; updates!
                </p>
                <p className="text-xs text-ink/60 mt-0.5">
                  Follow our page &amp; tag us in your review to get reposted.
                </p>
              </div>

              {/* Tag Quote / Caption if set */}
              {shareCaption && (
                <div className="rounded-xl border border-line bg-white p-3 text-xs text-ink/80 text-left space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink/50">
                    Suggested caption / hashtags
                  </span>
                  <p className="italic">&ldquo;{shareCaption}&rdquo;</p>
                </div>
              )}

              {/* Direct Follow & Review Cards */}
              <div className="flex flex-col gap-2.5">
                {instagramUrl && (
                  <div className="flex items-center justify-between rounded-xl border border-pink-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2.5 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 text-pink-600 shrink-0">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                        </svg>
                      </span>
                      <div>
                        <div className="text-xs font-bold text-ink">Instagram</div>
                        <div className="text-[11px] font-mono font-semibold text-pink-600">{igHandle}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={copyTaggedReview}
                        className="rounded-lg border border-line bg-zinc-50 px-2 py-1 text-[11px] font-medium text-ink/80 hover:bg-zinc-100 transition"
                      >
                        {copiedTagged ? "✓ Copied!" : "Copy @tag"}
                      </button>
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackSocialClick("instagram")}
                        className="rounded-lg bg-pink-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-pink-700 transition"
                      >
                        + Follow
                      </a>
                    </div>
                  </div>
                )}

                {facebookUrl && (
                  <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2.5 text-left">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                        </svg>
                      </span>
                      <div>
                        <div className="text-xs font-bold text-ink">Facebook</div>
                        <div className="text-[11px] font-mono font-semibold text-blue-600">{fbHandle}</div>
                      </div>
                    </div>
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackSocialClick("facebook")}
                      className="rounded-lg bg-blue-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      + Follow Page
                    </a>
                  </div>
                )}

                {googleUrl && (
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      trackClick();
                      setGooglePosted(true);
                    }}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 text-xs font-medium text-ink shadow-sm hover:bg-paper transition"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                        <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z" />
                        <path fill="#34A853" d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.6C3.7 20.4 7.5 23.2 12 23.2z" />
                      </svg>
                      <span>Also leave a Google Review</span>
                    </div>
                    <span className="text-emerald-700 font-semibold">Post on Maps ↗</span>
                  </a>
                )}
              </div>
            </div>

            {/* STAMP CARD: Gated behind Google Review */}
            {Boolean(googleUrl && !googlePosted && lastPlatform !== "google") ? (
              <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-4 text-center space-y-2.5 shadow-xs">
                <div className="flex items-center justify-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-sm">🔒</span>
                  <h3 className="text-xs font-bold text-amber-950">
                    Post on Google Maps to Unlock Today&apos;s Stamp!
                  </h3>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-relaxed">
                  Post your review on Google Maps to unlock your stamp card &amp; claim today&apos;s reward at the counter.
                </p>
                <a
                  href={googleUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackClick();
                    setGooglePosted(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition w-full"
                >
                  <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
                    <path d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                  </svg>
                  <span>Post Review to Unlock Stamp ↗</span>
                </a>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/90 p-4 text-center space-y-2 shadow-sm">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                  <span>🎉</span>
                  <span>Review Verified! Dining Offer Unlocked</span>
                </div>
                <p className="text-xs text-stone-600">
                  Avail your dining discount at checkout:
                </p>
                <a
                  href={`/r/${slug}/loyalty${sessionId ? `?session=${sessionId}` : ""}`}
                  className="flex items-center justify-between rounded-xl bg-amber-800 p-3.5 text-xs font-bold text-white shadow-md hover:bg-amber-900 transition"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-700 text-base">
                      🎁
                    </span>
                    <div>
                      <div className="text-xs font-bold text-white">View Dining Offer &amp; Vouchers</div>
                      <div className="text-[10px] font-normal text-amber-200">
                        Tap to calculate bill discount &amp; avail at counter
                      </div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-bold text-white">
                    View Offer →
                  </span>
                </a>
              </div>
            )}

            <p className="text-center text-xs text-ink/50">
              Thank you for visiting {name}. We hope to see you again soon!
            </p>
          </>
        )}

        {error && <p role="alert" className="text-center text-sm text-red-700">{error}</p>}
      </section>

      {step > 0 && step < 4 && (
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            setError("");
            setStep((current) => current - 1);
          }}
        >
          Back
        </button>
      )}
      <footer className="mt-4 text-center text-xs text-ink/40">Powered by ReviewFlow</footer>
    </main>
  );
}
