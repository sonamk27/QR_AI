"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget).entries());
      if (mode === "login" && portal) body.portal = portal;
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
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
      const message = caught instanceof Error ? caught.message : "Google sign-in failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const field = (name: string, label: string, type = "text", required = true) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} className="input" minLength={type === "password" ? 8 : undefined} />
    </div>
  );

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-5 py-10">
      <Link href="/" className="font-display text-xl font-semibold">ReviewFlow</Link>
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
      <form ref={formRef} onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && field("name", "Your name")}
        {mode === "signup" && field("restaurantName", "Restaurant name")}
        {mode === "signup" && field("city", "City", "text", false)}
        {field("email", "Email", "email")}
        {field("password", mode === "signup" ? "Password (8+ characters)" : "Password", "password")}
        {mode === "signup" && field("refCode", "Referral code (optional)", "text", false)}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      {portal !== "super_admin" && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-ink/45">
            <span className="h-px flex-1 bg-line" />
            <span>OR</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" className="btn-ghost w-full" onClick={signInWithGoogle} disabled={busy}>
            Continue with Google
          </button>
        </>
      )}
      {mode === "login" && portal === "super_admin" ? (
        <p className="mt-6 text-sm text-ink/70">
          Super Admin accounts are provisioned by the system administrator.
        </p>
      ) : (
        <p className="mt-6 text-sm text-ink/70">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <Link className="underline" href={mode === "login" ? "/signup" : "/login"}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </Link>
        </p>
      )}
      {mode === "login" && (
        <div className="mt-3 flex gap-4 text-sm">
          {portal !== "restaurant_admin" && (
            <Link className="text-ink/60 underline" href="/admin/login">Restaurant Admin portal</Link>
          )}
          {portal !== "super_admin" && (
            <Link className="text-ink/60 underline" href="/super-admin/login">Super Admin portal</Link>
          )}
        </div>
      )}
    </main>
  );
}
