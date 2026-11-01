"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { applyActionCode, getAuth } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

export function VerifyEmailView({ actionCode, initialEmail }: { actionCode: string; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<"checking" | "verified" | "waiting" | "error">(actionCode ? "checking" : "waiting");
  const [message, setMessage] = useState(actionCode ? "Verifying your email link…" : "Check your inbox for a verification link.");

  useEffect(() => {
    if (!actionCode) return;
    let cancelled = false;
    applyActionCode(getFirebaseAuth(), actionCode).then(() => {
      if (cancelled) return;
      setState("verified");
      setMessage("Your email is verified. You can now sign in.");
    }).catch(() => {
      if (!cancelled) {
        setState("error");
        setMessage("Could not verify this email link. Please try again.");
      }
    });
    return () => { cancelled = true; };
  }, [actionCode]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="screen-enter rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-subtle sm:p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF5ED] text-2xl">✉️</div>
        <h1 className="font-serif text-2xl font-bold text-[#24211E]">Verify your email</h1>
        <p className={`mt-2 text-sm ${state === "error" ? "text-red-700" : state === "verified" ? "text-green-700" : "text-[#716B64]"}`} role="status">{message}</p>
        {state !== "verified" && <p className="mt-5 text-xs text-[#716B64]">If you need another verification email, sign in with your email and password. ReviewFlow will send a new link before allowing access.</p>}
        <Link href="/login" className="mt-5 inline-flex text-sm font-semibold text-[#7A5826] underline">Go to sign in</Link>
      </section>
    </main>
  );
}
