"use client";

import { useState } from "react";

export function CopyLinkButton({ url, label = "Copy Link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="btn-ghost !px-2.5 !py-1 text-xs"
      title="Copy direct scan link"
    >
      {copied ? "Copied! ✓" : label}
    </button>
  );
}
