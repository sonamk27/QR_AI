"use client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-white"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      <span>🚪</span>
      <span>Sign out</span>
    </button>
  );
}
