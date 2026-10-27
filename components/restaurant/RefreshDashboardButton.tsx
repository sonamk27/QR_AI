"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshDashboardButton() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={refreshing}
      className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E8DFD1] bg-white px-3.5 text-xs font-semibold text-[#24211E] transition hover:bg-[#FAF7F2] disabled:opacity-60"
      aria-label="Refresh restaurant overview"
    >
      <span aria-hidden="true" className={refreshing ? "animate-spin" : "transition-transform duration-200 group-hover:rotate-180"}>↻</span>
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}
