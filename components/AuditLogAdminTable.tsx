"use client";

import { useState, useMemo } from "react";

type AuditLogRow = {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string | null;
  action: string;
  target: string | null;
  meta: any;
  createdAt: string;
};

export function AuditLogAdminTable({ logs }: { logs: AuditLogRow[] }) {
  const [search, setSearch] = useState("");
  const [actionCategory, setActionCategory] = useState("ALL");

  const categories = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      const prefix = l.action.split(".")[0];
      if (prefix) set.add(prefix);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (actionCategory !== "ALL" && !l.action.startsWith(actionCategory)) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        (l.target && l.target.toLowerCase().includes(q)) ||
        l.actorId.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        (l.actorEmail && l.actorEmail.toLowerCase().includes(q)) ||
        (l.meta && JSON.stringify(l.meta).toLowerCase().includes(q))
      );
    });
  }, [logs, search, actionCategory]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search action, target ID, actor ID, or metadata…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-sm"
          />

          <select
            value={actionCategory}
            onChange={(e) => setActionCategory(e.target.value)}
            className="input !w-auto"
          >
            <option value="ALL">All Action Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>

          {(search || actionCategory !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setActionCategory("ALL");
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
        <table className="w-full min-w-[700px]">
          <thead>
            <tr>
              <th className="th">Action</th>
              <th className="th">Target Entity</th>
              <th className="th">Who</th>
              <th className="th">Metadata</th>
              <th className="th">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="td text-center text-ink/60 py-10">
                  {logs.length === 0 ? "No audit log entries recorded." : "No actions match your filters."}
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="hover:bg-paper/40 transition">
                  <td className="td font-mono font-medium text-xs text-ink">
                    <span className="rounded bg-paper px-2 py-0.5 border border-line">
                      {l.action}
                    </span>
                  </td>
                  <td className="td font-mono text-xs text-ink/70">
                    {l.target ? (
                      <span title={l.target} className="max-w-[180px] truncate block">
                        {l.target}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="td text-xs text-ink/70">
                    <p className="font-medium text-ink">{l.actorName}</p>
                    {l.actorEmail ? (
                      <p className="text-[11px] text-ink/50">{l.actorEmail}</p>
                    ) : l.actorName !== "System webhook" ? (
                      <span className="font-mono text-[10px] text-ink/40" title={l.actorId}>
                        {l.actorId}
                      </span>
                    ) : null}
                  </td>
                  <td className="td text-xs text-ink/60 max-w-[200px] truncate font-mono">
                    {l.meta ? JSON.stringify(l.meta) : "—"}
                  </td>
                  <td className="td text-xs text-ink/70 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/50 text-right">
        Showing {filtered.length} of {logs.length} logged actions
      </p>
    </div>
  );
}
