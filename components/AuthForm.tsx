"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

type Portal = "restaurant_admin" | "super_admin";

export function AuthForm({
  mode,
  portal,
}: {
  mode: "login" | "signup";
  portal?: Portal;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (mode === "signup") formRef.current?.reset();
  }, [mode]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget).entries());
      if (mode === "login" && portal) body.portal = portal;
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push(data.redirect);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    const formData = formRef.current ? new FormData(formRef.current) : new FormData();
    if (
      mode === "signup" &&
      (!String(formData.get("name") ?? "").trim() ||
        !String(formData.get("restaurantName") ?? "").trim())
    ) {
      setError("Enter your name and restaurant name to create an account.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      let auth;
      try {
        auth = getFirebaseAuth();
      } catch {
        setError("Google sign-in is not available right now. Please use email and password instead.");
        return;
      }
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const body: Record<string, string> = {
        idToken: await credential.user.getIdToken(),
        mode,
      };
      if (mode === "signup") {
        body.name = String(formData.get("name") ?? "");
        body.restaurantName = String(formData.get("restaurantName") ?? "");
        body.city = String(formData.get("city") ?? "");
        body.refCode = String(formData.get("refCode") ?? "");
      }
      if (portal) body.portal = portal;

      const response = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Google sign-in failed. Please try again.");
        return;
      }
      router.push(data.redirect);
      router.refresh();
    } catch (caught) {
      const err = caught instanceof Error ? caught.message : "Google sign-in failed.";
      // Popup closed by user — don't treat as error
      if (err.includes("popup-closed-by-user") || err.includes("cancelled-popup-request")) {
        return;
      }
      setError(err.includes("not configured") ? "Google sign-in is not available. Please use email and password." : err);
    } finally {
      setBusy(false);
    }
  }

  const field = (
    name: string,
    label: string,
    type = "text",
    required = true,
    autoComplete = "off",
  ) => (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[#716B64]" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        autoCapitalize={type === "email" ? "none" : undefined}
        spellCheck={type === "email" ? false : undefined}
        className="w-full rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2.5 text-sm text-[#24211E] outline-none transition focus:border-[#B58A4B] focus:ring-1 focus:ring-[#B58A4B]"
        minLength={type === "password" ? 8 : undefined}
      />
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="screen-enter w-full">
      <Link href="/" aria-label="ReviewFlow home" className="inline-flex w-fit items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B58A4B]">
        <span className="flex h-12 w-24 items-center justify-center rounded-xl border border-[#E8DFD1] bg-white px-2 shadow-sm">
          <Image src="/logo.png" alt="" width={160} height={80} priority className="h-auto w-full object-contain" />
        </span>
        <span className="font-display text-xl font-semibold">ReviewFlow</span>
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink/50">
        {portal === "super_admin" ? "Platform management" : portal === "restaurant_admin" ? "Restaurant portal" : "Secure account access"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold">
        {mode === "login"
          ? portal === "super_admin"
            ? "Super Admin sign in"
            : portal === "restaurant_admin"
              ? "Restaurant Admin sign in"
              : "Sign in"
          : "Create your restaurant account"}
      </h1>
      <form ref={formRef} onSubmit={submit} autoComplete={mode === "signup" ? "off" : "on"} className="mt-6 space-y-4">
        {mode === "signup" && field("name", "Your name", "text", true, "name")}
        {mode === "signup" && field("restaurantName", "Restaurant name", "text", true, "organization")}
        {mode === "signup" && field("city", "City", "text", false, "address-level2")}
        {field("email", "Email", "email", true, mode === "signup" ? "off" : "username")}
        {field("password", mode === "signup" ? "Password (8+ characters)" : "Password", "password", true, mode === "signup" ? "new-password" : "current-password")}
        {mode === "signup" && field("refCode", "Referral code (optional)", "text", false)}
        {error && (
          <div role="alert" className="space-y-1 text-sm text-red-700">
            <p>{error}</p>
            {mode === "login" && error.toLowerCase().includes("verify your email") && (
              <Link href="/verify-email" className="inline-flex font-semibold underline">Resend verification link</Link>
            )}
          </div>
        )}
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      {mode === "signup" && portal !== "super_admin" && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-ink/45">
            <span className="h-px flex-1 bg-line" />
            <span>OR</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-paper hover:shadow-md active:scale-[0.98] disabled:opacity-60"
          >
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </>
      )}
      {mode === "login" && portal === "super_admin" ? (
        <p className="mt-6 text-sm text-ink/70">
          Super Admin accounts are provisioned by the system administrator.
        </p>
      ) : mode === "signup" ? (
        <p className="mt-6 text-sm text-ink/70">
          Already have an account? {" "}
          <Link className="underline" href="/login">
            Sign in
          </Link>
        </p>
      ) : null}
      </section>
    </main>
  );
}
