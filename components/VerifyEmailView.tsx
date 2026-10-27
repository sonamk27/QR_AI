"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function VerifyEmailView({ token, initialEmail }: { token: string; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<"checking" | "verified" | "waiting" | "error">(token ? "checking" : "waiting");
  const [message, setMessage] = useState(token ? "Verifying your email link…" : "Check your inbox for a verification link.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const data = await response.json();
      if (cancelled) return;
      setState(response.ok ? "verified" : "error");
      setMessage(response.ok ? "Your email is verified. You can now sign in." : data.error || "Could not verify this email link.");
    }).catch(() => {
      if (!cancelled) {
        setState("error");
        setMessage("Could not verify this email link. Please try again.");
      }
    });
    return () => { cancelled = true; };
  }, [token]);

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send a new link.");
      setState("waiting");
      setMessage(data.message);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not send a new link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="screen-enter rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-subtle sm:p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF5ED] text-2xl">✉️</div>
        <h1 className="font-serif text-2xl font-bold text-[#24211E]">Verify your email</h1>
        <p className={`mt-2 text-sm ${state === "error" ? "text-red-700" : state === "verified" ? "text-green-700" : "text-[#716B64]"}`} role="status">{message}</p>
        {state !== "verified" && (
          <form onSubmit={resend} className="mt-5 space-y-3">
            <label className="block text-xs font-semibold text-[#716B64]" htmlFor="verify-email-address">Email address</label>
            <input id="verify-email-address" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input" />
            <button type="submit" disabled={busy} className="btn w-full">{busy ? "Sending…" : "Send a new verification link"}</button>
          </form>
        )}
        <Link href="/login" className="mt-5 inline-flex text-sm font-semibold text-[#7A5826] underline">Go to sign in</Link>
      </section>
    </main>
  );
}
