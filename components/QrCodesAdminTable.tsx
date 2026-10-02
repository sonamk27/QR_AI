"use client";

import { useState, useMemo } from "react";
import { QrRowActions } from "@/components/SuperAdminModals";

const DAY = 86_400_000;

type QrItem = {
  id: string;
  name: string;
  location: string | null;
  tableNo: string | null;
  slug: string;
  status: string;
  resolvedStatus: "ACTIVE" | "GRACE" | "EXPIRED" | "DISABLED" | "PENDING_PAYMENT";
  validUntil: string | null;
  createdAt: string;
  restaurant: {
    id: string;
    name: string;
    city: string | null;
    owner: { name: string; email: string };
  };
  _count: {
    scans: number;
    sessions: number;
  };
};

export function QrCodesAdminTable({
  qrCodes,
  restaurants,
  appUrl,
}: {
  qrCodes: QrItem[];
  restaurants: { id: string; name: string; city: string | null; owner: { name: string; email: string } }[];
  appUrl: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [restaurantFilter, setRestaurantFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return qrCodes.filter((q) => {
      if (statusFilter !== "ALL" && q.resolvedStatus !== statusFilter) return false;
      if (restaurantFilter !== "ALL" && q.restaurant.id !== restaurantFilter) return false;

      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        q.name.toLowerCase().includes(term) ||
        q.restaurant.name.toLowerCase().includes(term) ||
        (q.location && q.location.toLowerCase().includes(term)) ||
        (q.tableNo && q.tableNo.toLowerCase().includes(term))
      );
    });
  }, [qrCodes, search, statusFilter, restaurantFilter]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search by QR name, restaurant, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input !w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="GRACE">Grace Period</option>
            <option value="EXPIRED">Expired</option>
            <option value="PENDING_PAYMENT">Pending Payment</option>
            <option value="DISABLED">Disabled</option>
          </select>

          <select
            value={restaurantFilter}
            onChange={(e) => setRestaurantFilter(e.target.value)}
            className="input !w-auto max-w-[200px]"
          >
            <option value="ALL">All Restaurants</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {(search || statusFilter !== "ALL" || restaurantFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setRestaurantFilter("ALL");
              }}
              className="text-xs text-ink/50 hover:text-ink underline px-2"
            >
              Reset
            </button>
          )}
        </div>

      </div>

      {/* Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr>
              <th className="th">QR Name</th>
              <th className="th">Restaurant</th>
              <th className="th">Status</th>
              <th className="th">Validity / Days Left</th>
              <th className="th">Valid Until</th>
              <th className="th">Scans</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="td text-center text-ink/60 py-10">
                  {qrCodes.length === 0
                    ? "No QR codes created yet. Click '+ Create & Activate QR' to start."
                    : "No QR codes match the current filters."}
                </td>
              </tr>
            ) : (
              filtered.map((q) => {
                const days = q.validUntil
                  ? Math.ceil((new Date(q.validUntil).getTime() - Date.now()) / DAY)
                  : 0;

                return (
                  <tr key={q.id} className="hover:bg-paper/40 transition">
                    <td className="td">
                      <p className="font-semibold text-ink">{q.name}</p>
                      <p className="text-xs text-ink/60">
                        {q.location || (q.tableNo ? `Table ${q.tableNo}` : "Counter")}
                      </p>
                    </td>
                    <td className="td">
                      <p className="font-medium text-ink">{q.restaurant.name}</p>
                      <p className="text-xs text-ink/60">{q.restaurant.city || "—"}</p>
                    </td>
                    <td className="td">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          q.resolvedStatus === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : q.resolvedStatus === "GRACE"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : q.resolvedStatus === "EXPIRED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : q.resolvedStatus === "PENDING_PAYMENT"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        }`}
                      >
                        {q.resolvedStatus === "PENDING_PAYMENT"
                          ? "Pending Payment"
                          : q.resolvedStatus.toLowerCase()}
                      </span>
                    </td>
                    <td className="td font-medium text-xs">
                      {q.resolvedStatus === "DISABLED" || q.resolvedStatus === "PENDING_PAYMENT" ? (
                        <span className="text-ink/40">–</span>
                      ) : days > 30 ? (
                        <span className="text-emerald-700 font-semibold">{days}d left</span>
                      ) : days > 0 ? (
                        <span className="text-amber-700 font-semibold">{days}d left</span>
                      ) : (
                        <span className="text-rose-700 font-semibold">
                          {Math.abs(days)}d expired
                        </span>
                      )}
                    </td>
                    <td className="td text-xs text-ink/70">
                      {q.validUntil
                        ? new Date(q.validUntil).toLocaleDateString("en-IN", { dateStyle: "medium" })
                        : "–"}
                    </td>
                    <td className="td text-xs">
                      <span className="font-medium text-ink">{q._count.scans}</span>
                      <span className="text-ink/40 ml-1">({q._count.sessions} reviews)</span>
                    </td>
                    <td className="td">
                      <QrRowActions
                        qrId={q.id}
                        slug={q.slug}
                        name={q.name}
                        restaurantName={q.restaurant.name}
                        status={q.resolvedStatus}
                        appUrl={appUrl}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/50 text-right">
        Showing {filtered.length} of {qrCodes.length} QR codes
      </p>
    </div>
  );
}
