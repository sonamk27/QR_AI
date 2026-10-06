"use client";

import { useEffect, useRef, useState } from "react";
import { Stars } from "./Stars";

type Rec = { stop: () => void };

export function Flow({
  slug,
  name,
  logoUrl,
  color,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  color: string;
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
    window.location.assign(googleUrl);
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
