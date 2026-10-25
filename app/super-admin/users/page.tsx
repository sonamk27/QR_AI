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
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#24211E]">User Management</h1>
          <p className="mt-1 text-sm text-[#716B64]">
            Manage user accounts and passwords. Super Admin access is provisioned through the seed script.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Total Users</span>
            <span className="font-bold text-[#24211E]">{users.length}</span>
          </div>
          <div className="rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#B58A4B] block font-medium">Restaurant Admins</span>
            <span className="font-bold text-[#B58A4B]">{adminCount}</span>
          </div>
          <div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Super Admins</span>
            <span className="font-bold text-[#24211E]">{superAdminCount}</span>
          </div>
        </div>
      </div>

      <UsersAdminTable users={serialized} />
    </div>
  );
}
