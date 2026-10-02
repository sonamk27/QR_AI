import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { UsersAdminTable } from "@/components/UsersAdminTable";

export const dynamic = "force-dynamic";

export default async function SuperAdminUsersPage() {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      restaurants: {
        select: { id: true, name: true, city: true, status: true },
      },
    },
  });

  const serialized = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    restaurants: u.restaurants,
  }));

  const adminCount = users.filter((u) => u.role === "restaurant_admin").length;
  const superAdminCount = users.filter((u) => u.role === "super_admin").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">User Management</h1>
          <p className="mt-1 text-sm text-ink/70">
            Manage user accounts and passwords. Super Admin access is provisioned through the seed script.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-lg border border-line bg-white px-3 py-1.5 text-center">
            <span className="text-ink/60 block">Total Users</span>
            <span className="font-semibold text-ink">{users.length}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
            <span className="text-blue-800/70 block">Restaurant Admins</span>
            <span className="font-semibold text-blue-900">{adminCount}</span>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-center">
            <span className="text-purple-800/70 block">Super Admins</span>
            <span className="font-semibold text-purple-900">{superAdminCount}</span>
          </div>
        </div>
      </div>

      <UsersAdminTable users={serialized} />
    </div>
  );
}
