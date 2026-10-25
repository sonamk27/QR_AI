"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

  const field = (name: string, label: string, type = "text", required = true) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} className="input" minLength={type === "password" ? 8 : undefined} />
    </div>
  );

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-5 py-10">
      <a href="/" className="font-display text-xl font-semibold">ReviewFlow</a>
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
    </main>
  );
}
