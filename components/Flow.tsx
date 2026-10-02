"use client";
import { useEffect, useRef, useState } from "react";
import { Stars } from "./Stars";

const CHIPS = ["Food", "Staff", "Ambience", "Cleanliness", "Value", "Speed"];
type Rec = { stop: () => void };

export function Flow({ slug, name, logoUrl, color }: { slug: string; name: string; logoUrl: string | null; color: string }) {
  const [step, setStep] = useState(0);
  const [overall, setOverall] = useState(0);
  const [food, setFood] = useState(0);
  const [service, setService] = useState(0);
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    fetch(`/api/public/${slug}/scan`, { method: "POST" }).catch(() => {});
  }, [slug]);

  const next = () => setStep((s) => s + 1);
  const rate = (setter: (n: number) => void) => (n: number) => {
    setter(n);
    setTimeout(next, 250);
  };

  async function generate(variant?: "short" | "casual" | "detailed") {
    setBusy(true);
    setError("");
    const res = await fetch("/api/public/generate-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, sessionId, overall, food: food || undefined, service: service || undefined, chips, text: text || undefined, variant }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not write your draft. Try again.");
    setDraft(data.text);
    setSessionId(data.sessionId);
    setGoogleUrl(data.googleUrl);
    setStep(5);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the text and copy it manually.");
    }
  }

  function trackClick() {
    if (!sessionId) return;
    navigator.sendBeacon?.("/api/public/google-click", new Blob([JSON.stringify({ sessionId, editedText: draft })], { type: "application/json" }));
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

  const toggle = (c: string) => setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const accent = { backgroundColor: color };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="text-center">
        {logoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt="" className="mx-auto mb-2 h-14 w-14 rounded-full object-cover" />}
        <p className="font-display text-xl font-semibold">{name}</p>
        <div className="mx-auto mt-3 h-1 w-24 overflow-hidden rounded bg-line"><div className="h-1 transition-all" style={{ ...accent, width: `${((step + 1) / 6) * 100}%` }} /></div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-8">
        {step === 0 && (<><h1 className="text-center text-3xl font-semibold">How was your visit?</h1><Stars value={overall} onChange={rate(setOverall)} /></>)}
        {step === 1 && (<><h1 className="text-center text-3xl font-semibold">How was the food?</h1><Stars value={food} onChange={rate(setFood)} /><button className="text-sm underline" onClick={next}>Skip</button></>)}
        {step === 2 && (<><h1 className="text-center text-3xl font-semibold">How was the service?</h1><Stars value={service} onChange={rate(setService)} /><button className="text-sm underline" onClick={next}>Skip</button></>)}
        {step === 3 && (
          <>
            <h1 className="text-center text-3xl font-semibold">What did you enjoy?</h1>
            <div className="flex flex-wrap justify-center gap-2">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => toggle(c)} aria-pressed={chips.includes(c)} className={`rounded-full border px-4 py-2 text-sm ${chips.includes(c) ? "border-transparent text-white" : "border-line bg-white"}`} style={chips.includes(c) ? accent : undefined}>{c}</button>
              ))}
            </div>
            <button className="btn" onClick={next}>{chips.length ? "Next" : "Nothing in particular"}</button>
          </>
        )}
        {step === 4 && (
          <>
            <h1 className="text-center text-3xl font-semibold">Anything you'd like to add?</h1>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={4} className="input" placeholder="Optional. A dish you loved, or what could be better." aria-label="Your comments" />
            <button className="btn-ghost" onClick={voice}>{listening ? "Stop listening" : "Speak instead"}</button>
            <button className="btn" onClick={() => generate()} disabled={busy} style={accent}>{busy ? "Writing your draft…" : "Write my draft"}</button>
          </>
        )}
        {step === 5 && (
          <>
            <h1 className="text-center text-3xl font-semibold">Your draft is ready</h1>
            <p className="text-center text-sm text-ink/70">Change anything so it sounds like you. You post it yourself on Google.</p>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="input" aria-label="Your review draft" />
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => generate()} disabled={busy}>{busy ? "Rewriting…" : "Rewrite"}</button>
              <button className="btn-ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => generate("short")} disabled={busy}>Make it shorter</button>
              <button className="btn-ghost" onClick={() => generate("detailed")} disabled={busy}>Add detail</button>
            </div>
            {googleUrl ? (
              <a className="btn" style={accent} href={googleUrl} target="_blank" rel="noreferrer" onClick={() => { copy(); trackClick(); }}>Copy and continue to Google</a>
            ) : (
              <p className="text-center text-sm text-ink/60">The restaurant has not added its Google link yet. You can still copy your draft.</p>
            )}
            <p className="text-center text-xs text-ink/50">On Google, paste your text and tap Post.</p>
          </>
        )}
        {error && <p role="alert" className="text-center text-sm text-red-700">{error}</p>}
      </section>

      {step > 0 && step < 5 && <button className="text-sm underline" onClick={() => setStep((s) => s - 1)}>Back</button>}
      <footer className="mt-4 text-center text-xs text-ink/40">Powered by ReviewFlow</footer>
    </main>
  );
}
