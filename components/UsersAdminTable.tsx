"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "restaurant_admin" | "super_admin";
  createdAt: string;
  restaurants: { id: string; name: string; city: string | null; status: string }[];
};

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successInfo, setSuccessInfo] = useState<{ pass: string } | null>(null);

  function generatePass() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let p = "Rf";
    for (let i = 0; i < 6; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(p);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/super-admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          newPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");

      setSuccessInfo({ pass: password });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  const welcomeMessage = successInfo
    ? `Hello ${user.name}! Your ReviewFlow password has been updated.\n\n` +
      `🌐 Login: ${typeof window !== "undefined" ? window.location.origin : ""}/login\n` +
      `📧 Email: ${user.email}\n` +
      `🔑 Password: ${successInfo.pass}\n\n` +
      `You can now log in to your dashboard.`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        {successInfo ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
              <h3 className="font-semibold text-emerald-900">Password Reset Successful</h3>
              <p className="mt-1 text-xs text-emerald-800">
                The password for {user.name} ({user.email}) has been updated.
              </p>
            </div>

            <div className="rounded-lg bg-paper p-3 text-xs font-mono whitespace-pre-wrap select-all border border-line">
              {welcomeMessage}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(welcomeMessage);
                  alert("Copied to clipboard!");
                }}
                className="btn flex-1 text-xs"
              >
                Copy Credentials
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(welcomeMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost flex-1 text-xs text-center"
              >
                Share via WhatsApp
              </a>
              <button onClick={onClose} className="btn-ghost text-xs">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-semibold text-ink">Reset Password</h3>
                <p className="text-xs text-ink/60">{user.name} ({user.email})</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-ink/50 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            {error && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label !mb-0">New Password *</label>
                <button
                  type="button"
                  onClick={generatePass}
                  className="text-xs text-leaf hover:underline"
                >
                  Generate Random
                </button>
              </div>
              <input
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter or generate temporary password"
                className="input font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Set New Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function UsersAdminTable({ users }: { users: UserItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [resetModalUser, setResetModalUser] = useState<UserItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.restaurants.some((r) => r.name.toLowerCase().includes(q))
      );
    });
  }, [users, search, roleFilter]);

  async function toggleRole(user: UserItem) {
    const nextRole = user.role === "super_admin" ? "restaurant_admin" : "super_admin";
    if (
      !confirm(
        `Are you sure you want to change ${user.name}'s role to ${nextRole}?`,
      )
    )
      return;

    setBusyId(user.id);
    try {
      const res = await fetch(`/api/super-admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_role", role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to change role.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search by name, email, or restaurant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-sm"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input !w-auto"
          >
            <option value="ALL">All Roles</option>
            <option value="restaurant_admin">Restaurant Admins</option>
            <option value="super_admin">Super Admins</option>
          </select>

          {(search || roleFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("ALL");
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
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Associated Restaurants</th>
              <th className="th">Joined</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="td text-center text-ink/60 py-10">
                  {users.length === 0 ? "No users registered yet." : "No users match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-paper/40 transition">
                  <td className="td font-semibold text-ink">{u.name}</td>
                  <td className="td text-ink/80 text-xs font-mono">{u.email}</td>
                  <td className="td">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        u.role === "super_admin"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {u.role === "super_admin" ? "Super Admin" : "Restaurant Admin"}
                    </span>
                  </td>
                  <td className="td text-xs">
                    {u.restaurants.length === 0 ? (
                      <span className="text-ink/40">No restaurants</span>
                    ) : (
                      <div className="space-y-1">
                        {u.restaurants.map((r) => (
                          <div key={r.id} className="flex items-center gap-1.5">
                            <span className="font-medium text-ink">{r.name}</span>
                            {r.city && <span className="text-ink/50">({r.city})</span>}
                            {r.status === "SUSPENDED" && (
                              <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[10px] text-rose-700 border border-rose-200">
                                Suspended
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="td text-xs text-ink/70">
                    {new Date(u.createdAt).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setResetModalUser(u)}
                        className="btn-ghost !px-2.5 !py-1 text-xs"
                      >
                        Reset Password
                      </button>
                      {u.role === "super_admin" ? (
                        <button
                          onClick={() => toggleRole(u)}
                          disabled={busyId === u.id}
                          className="btn-ghost !px-2.5 !py-1 text-xs"
                          title="Demote to restaurant admin"
                        >
                          Make Restaurant Admin
                        </button>
                      ) : (
                        <span className="text-[11px] text-ink/50">
                          Super Admin access is provisioned by seed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/50 text-right">
        Showing {filtered.length} of {users.length} users
      </p>

      {resetModalUser && (
        <ResetPasswordModal
          user={resetModalUser}
          onClose={() => setResetModalUser(null)}
        />
      )}
    </div>
  );
}
