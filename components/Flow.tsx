"use client";
import { useEffect, useRef, useState } from "react";
import { Stars } from "./Stars";

type Rec = { stop: () => void };

export function Flow({ slug, name, logoUrl, color }: { slug: string; name: string; logoUrl: string | null; color: string }) {
  const [step, setStep] = useState(0);
  const [food, setFood] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    fetch(`/api/public/${slug}/scan`, { method: "POST" }).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (step !== 1) return;

    let cancelled = false;
    setSuggestions([]);
    setChips([]);
    setSuggestionBusy(true);
    setError("");
    fetch("/api/public/suggest-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        food,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not get feedback suggestions.");
        if (!cancelled) setSuggestions(data.suggestions);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not get feedback suggestions.");
        }
      })
      .finally(() => {
        if (!cancelled) setSuggestionBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, slug, food]);

  const next = () => setStep((s) => s + 1);
  const rate = (setter: (n: number) => void) => (n: number) => {
    setter(n);
    setTimeout(next, 250);
  };

  async function submitFeedback() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public/submit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          overall: food,
          food,
          chips,
          text: text || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not submit your feedback. Try again.");
      }
      setSessionId(data.sessionId);
      setGoogleUrl(data.googleUrl);
      setStep(5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit your feedback. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function trackClick() {
    if (!sessionId) return;
    navigator.sendBeacon?.(
      "/api/public/google-click",
      new Blob([JSON.stringify({ sessionId })], { type: "application/json" }),
    );
  }

  function voice() {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return setError("Voice input is not supported on this browser. You can type instead.");
    if (listening) return rec.current?.stop();
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => setText((t) => `${t} ${e.results[0][0].transcript}`.trim());
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  const toggle = (suggestion: string) =>
    setChips((selected) =>
      selected.includes(suggestion)
        ? selected.filter((item) => item !== suggestion)
        : [...selected, suggestion],
    );
  const accent = { backgroundColor: color };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="text-center">
        {logoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt="" className="mx-auto mb-2 h-14 w-14 rounded-full object-cover" />}
        <p className="font-display text-xl font-semibold">{name}</p>
        <div className="mx-auto mt-3 h-1 w-24 overflow-hidden rounded bg-line"><div className="h-1 transition-all" style={{ ...accent, width: `${((step + 1) / 4) * 100}%` }} /></div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-8">
        {step === 0 && (
          <>
            <h1 className="text-center text-3xl font-semibold">How was the food?</h1>
            <p className="text-center text-sm text-ink/70">
              Rate it from 1 (poor) to 5 (excellent). We&apos;ll suggest feedback based on your rating.
            </p>
            <Stars value={food} onChange={rate(setFood)} label="Food rating" />
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="text-center text-3xl font-semibold">Choose feedback suggestions</h1>
            <p className="text-center text-sm text-ink/70">
              Based on your food rating, select the statements that match your experience.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => toggle(suggestion)}
                  aria-pressed={chips.includes(suggestion)}
                  className={`rounded-full border px-4 py-2 text-sm ${chips.includes(suggestion) ? "border-transparent text-white" : "border-line bg-white"}`}
                  style={chips.includes(suggestion) ? accent : undefined}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            {suggestionBusy && (
              <p className="text-center text-sm text-ink/60">Preparing suggestions…</p>
            )}
            {!suggestionBusy && suggestions.length === 0 && (
              <p className="text-center text-sm text-ink/60">
                You can continue without selecting a suggestion.
              </p>
            )}
            <button className="btn" onClick={next} disabled={suggestionBusy}>
              {chips.length ? "Next" : "Continue"}
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-center text-3xl font-semibold">Add any other feedback?</h1>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={4} className="input" placeholder="Optional. A dish you loved, or what could be better." aria-label="Your comments" />
            <button className="btn-ghost" onClick={voice}>{listening ? "Stop listening" : "Speak instead"}</button>
            <button className="btn" onClick={submitFeedback} disabled={busy} style={accent}>
              {busy ? "Submitting…" : "Submit feedback"}
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-center text-3xl font-semibold">Thanks for your feedback</h1>
            <p className="text-center text-sm text-ink/70">
              Your ratings and selected suggestions have been shared with {name}.
            </p>
            {googleUrl ? (
              <a className="btn" style={accent} href={googleUrl} target="_blank" rel="noreferrer" onClick={trackClick}>
                Leave a Google review
              </a>
            ) : (
              <p className="text-center text-sm text-ink/60">
                The restaurant has not added its Google review link yet.
              </p>
            )}
            <p className="text-center text-xs text-ink/50">
              The suggestions are optional. Write and post your own review on Google if you wish.
            </p>
          </>
        )}
        {error && <p role="alert" className="text-center text-sm text-red-700">{error}</p>}
      </section>

      {step > 0 && step < 3 && <button className="text-sm underline" onClick={() => setStep((s) => s - 1)}>Back</button>}
      <footer className="mt-4 text-center text-xs text-ink/40">Powered by ReviewFlow</footer>
    </main>
  );
}
