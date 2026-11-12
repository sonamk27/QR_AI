import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";
import { useAuthState } from "./AuthState";

type PendingStampRequest = {
  id: string;
  customerName: string;
  tableNo: string;
  createdAt: Date | null;
};

function timestampDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  return null;
}

export function PendingStampRequestsSummary() {
  const { user } = useAuthState();
  const [requests, setRequests] = useState<PendingStampRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const { db } = getFirebaseServices();
      const snapshot = await getDocs(query(
        collection(db, "stampRequests"),
        where("ownerUid", "==", user.uid),
        where("status", "==", "PENDING"),
        limit(10),
      ));
      setRequests(snapshot.docs.map((request) => {
        const row = request.data();
        return {
          id: request.id,
          customerName: String(row.customerName || "Customer"),
          tableNo: String(row.tableNo || "Visit"),
          createdAt: timestampDate(row.createdAt),
        };
      }).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)));
      setError("");
    } catch (caught) {
      console.error("Pending stamp requests could not be loaded", caught);
      setError("Could not load stamp requests. Check your Firestore access and try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadRequests();
    const interval = setInterval(() => void loadRequests(true), 30_000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  return (
    <section className="rounded-2xl border border-[#E8D8BA] bg-white p-4 shadow-subtle sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-bold text-[#24211E]">Pending stamp requests</h2>
          <p className="mt-1 text-xs text-[#716B64]">Customer visit requests awaiting staff approval.</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && requests.length > 0 && (
            <span className="rounded-full bg-[#B58A4B] px-2.5 py-1 text-xs font-bold text-white">
              {requests.length} pending
            </span>
          )}
          <button
            onClick={() => void loadRequests()}
            disabled={loading}
            className="min-h-9 rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3 text-xs font-semibold text-[#716B64] disabled:opacity-60"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </p>
      ) : loading ? (
        <p className="mt-4 py-4 text-center text-xs text-[#716B64]">Checking for stamp requests…</p>
      ) : requests.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[#E8DFD1] bg-[#FAF7F2]/60 py-5 text-center text-xs text-[#716B64]">
          No pending stamp requests.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[#E8DFD1]/60">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
              <span className="font-semibold text-[#24211E]">
                {request.customerName} <span className="font-normal text-[#716B64]">· {request.tableNo}</span>
              </span>
              <time className="text-[#716B64]">
                {request.createdAt
                  ? request.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                  : "Recently"}
              </time>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/dashboard/loyalty"
        className="mt-3 inline-flex min-h-10 items-center text-xs font-bold text-[#9A7441] underline underline-offset-2"
      >
        Review and approve requests →
      </Link>
    </section>
  );
}
