"use client";

import { useState, useMemo } from "react";
import { CreateRestaurantModal } from "@/components/SuperAdminModals";
import { AdminButton } from "@/components/AdminActions";

type RestaurantRow = {
  id: string;
  name: string;
  city: string | null;
  brandColor: string;
  status: string;
  referredByName: string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    qrCodes: number;
  };
};

export function RestaurantsAdminTable({
  restaurants,
}: {
  restaurants: RestaurantRow[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [sellerFilter, setSellerFilter] = useState("ALL");

  const sellers = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => {
      if (r.referredByName?.trim()) set.add(r.referredByName.trim());
    });
    return Array.from(set).sort();
  }, [restaurants]);

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (sellerFilter !== "ALL" && (r.referredByName?.trim() || "Direct") !== sellerFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        r.owner.name.toLowerCase().includes(q) ||
        r.owner.email.toLowerCase().includes(q) ||
        (r.referredByName && r.referredByName.toLowerCase().includes(q))
      );
    });
  }, [restaurants, search, statusFilter, sellerFilter]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search by restaurant, city, owner, or seller…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input !w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
          </select>

          {sellers.length > 0 && (
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="input !w-auto"
            >
              <option value="ALL">All Sellers</option>
              {sellers.map((s) => (
                <option key={s} value={s}>
                  Seller: {s}
                </option>
              ))}
            </select>
          )}

          {(search || statusFilter !== "ALL" || sellerFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setSellerFilter("ALL");
              }}
              className="text-xs text-ink/50 hover:text-ink underline px-2"
            >
              Reset filters
            </button>
          )}
        </div>

        <CreateRestaurantModal />
      </div>

      {/* Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className="th">Restaurant</th>
              <th className="th">Owner &amp; Contact</th>
              <th className="th">QR Codes</th>
              <th className="th">Referred By (Seller)</th>
              <th className="th">Joined</th>
              <th className="th">Status</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="td text-center text-ink/60 py-10">
                  {restaurants.length === 0
                    ? "No restaurants onboarded yet. Click '+ Add Restaurant & Owner' to start."
                    : "No restaurants matched your filters."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-paper/40 transition">
                  <td className="td font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: r.brandColor || "#1F6F5C" }}
                      />
                      <div>
                        <p className="font-semibold text-ink">{r.name}</p>
                        <p className="text-xs font-normal text-ink/60">{r.city || "No city"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <p className="font-medium text-ink">{r.owner.name}</p>
                    <p className="text-xs text-ink/60">{r.owner.email}</p>
                  </td>
                  <td className="td">
                    <span className="inline-flex items-center rounded-md bg-paper px-2 py-0.5 text-xs font-semibold text-ink border border-line">
                      {r._count.qrCodes} QR{r._count.qrCodes !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="td">
                    {r.referredByName ? (
                      <span className="inline-flex items-center rounded-full bg-paper px-2.5 py-0.5 text-xs font-medium text-ink border border-line">
                        {r.referredByName}
                      </span>
                    ) : (
                      <span className="text-xs text-ink/40">Direct / None</span>
                    )}
                  </td>
                  <td className="td text-xs text-ink/70">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </td>
                  <td className="td">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {r.status === "ACTIVE" ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <AdminButton
                        url={`/api/super-admin/restaurants/${r.id}`}
                        method="PATCH"
                        body={{ status: r.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }}
                        label={r.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/50 text-right">
        Showing {filtered.length} of {restaurants.length} restaurants
      </p>
    </div>
  );
}
