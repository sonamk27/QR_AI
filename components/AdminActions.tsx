"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminButton({ url, method, body, label }: { url: string; method: "PATCH" | "POST"; body: unknown; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!confirm(`${label}?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${label.toLowerCase()}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${label.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        className="btn-ghost !px-2.5 !py-1.5 text-xs"
        onClick={submit}
        disabled={busy}
      >
        {busy ? "Saving…" : label}
      </button>
      {error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
