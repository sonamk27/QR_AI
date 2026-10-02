import { redirect } from "next/navigation";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayoutShell } from "@/components/admin/AdminLayoutShell";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await getOwnerContext();
  if (!ctx) redirect("/login");

  const pendingRequestsCount = await db.qrRequest.count({
    where: {
      restaurantId: ctx.restaurant.id,
      status: { in: ["PENDING_APPROVAL", "APPROVED_PAYMENT_DUE"] },
    },
  });

  return (
    <AdminLayoutShell
      restaurant={ctx.restaurant}
      user={ctx.user}
      pendingRequestsCount={pendingRequestsCount}
    >
      {children}
    </AdminLayoutShell>
  );
}
