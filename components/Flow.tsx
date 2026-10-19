"use client";

import { useEffect, useRef, useState } from "react";
import { Stars } from "./Stars";

type Rec = { stop: () => void };

export function Flow({
  slug,
  restaurantId,
  name,
  logoUrl,
  color,
  instagramUrl,
  facebookUrl,
  shareCaption,
}: {
  slug: string;
  restaurantId: string;
  name: string;
  logoUrl: string | null;
  color: string;
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
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [draftVariantIndex, setDraftVariantIndex] = useState(1);
  const [busy, setBusy] = useState(false);
  const [copyingAndContinuing, setCopyingAndContinuing] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);

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
      setGoogleUrl(data.googleUrl);
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

  async function copyAndContinue() {
    if (!googleUrl) return;
    setCopyingAndContinuing(true);
    setError("");
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      setError("Could not copy your review. Please allow clipboard access and try again.");
      setCopyingAndContinuing(false);
      return;
    }
    trackClick();
    // Go to thank-you screen instead of leaving immediately
    setStep(5);
    setCopyingAndContinuing(false);
    // Open Google in a new tab
    window.open(googleUrl, "_blank", "noopener,noreferrer");
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
  // Step 5 is the thank-you screen — always 100%
  const progress = step < 3 ? ((step + 1) / 4) * 100 : step === 3 ? 85 : 100;

  const hasSocial = instagramUrl || facebookUrl;

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
              disabled={busy || copyingAndContinuing}
            >
              {busy ? "Regenerating…" : "Generate another draft"}
            </button>
            {googleUrl ? (
              <button
                type="button"
                className="btn"
                style={accent}
                onClick={copyAndContinue}
                disabled={busy || copyingAndContinuing}
              >
                {copyingAndContinuing ? "Copying and opening…" : busy ? "Regenerating…" : "Copy and continue"}
              </button>
            ) : (
              <p className="text-center text-sm text-ink/60">
                Your draft is ready. This restaurant has not added its Google review link yet.
              </p>
            )}
            <p className="text-center text-xs text-ink/50">
              You can choose what to post on Google. Your ratings don&apos;t affect access to the link.
            </p>
          </>
        )}

        {step === 5 && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-5xl">🎉</span>
              <h1 className="text-3xl font-semibold">Thank you!</h1>
              <p className="text-sm text-ink/70">
                Your review draft was copied. Paste it when Google opens and tap Post — it means a lot to us.
              </p>
            </div>

            {hasSocial && (
              <div className="rounded-xl border border-line bg-paper p-4 text-center space-y-3">
                <p className="text-sm font-medium text-ink">
                  Enjoyed your visit? Follow us for updates &amp; offers!
                </p>

                {shareCaption && (
                  <p className="text-xs text-ink/60 italic">&ldquo;{shareCaption}&rdquo;</p>
                )}

                <div className="flex justify-center gap-3">
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackSocialClick("instagram")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-paper transition"
                      aria-label="Follow on Instagram"
                    >
                      {/* Instagram SVG icon */}
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-pink-500" aria-hidden="true">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.247 2.242 1.31 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.242 1.247-3.608 1.31-1.265.058-1.645.069-4.849.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.247-2.242-1.31-3.608C2.175 15.585 2.163 15.205 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608.975-.975 2.242-1.247 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.197.163 3.475.705 2.14 2.14.705 3.475.163 5.197.072 7.052.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.091 1.854.633 3.576 2.068 5.012C3.475 23.295 5.197 23.837 7.052 23.928 8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.854-.091 3.576-.633 5.012-2.068 1.435-1.435 1.977-3.158 2.068-5.012.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.091-1.854-.633-3.576-2.068-5.012C20.525.705 18.803.163 16.948.072 15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                      </svg>
                      Instagram
                    </a>
                  )}

                  {facebookUrl && (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackSocialClick("facebook")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-paper transition"
                      aria-label="Follow on Facebook"
                    >
                      {/* Facebook SVG icon */}
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-blue-600" aria-hidden="true">
                        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                      </svg>
                      Facebook
                    </a>
                  )}
                </div>
              </div>
            )}

            {googleUrl && (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn text-center"
                style={accent}
                onClick={trackClick}
              >
                Open Google to post
              </a>
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
