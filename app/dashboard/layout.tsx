import { redirect } from "next/navigation";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayoutShell } from "@/components/admin/AdminLayoutShell";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await getOwnerContext();
  if (!ctx) redirect("/login");

  const [pendingRequestsCount, pendingStampRequestsCount] = await Promise.all([
    db.qrRequest.count({
      where: {
        restaurant: { ownerId: ctx.user.id },
        status: { in: ["PENDING_APPROVAL", "APPROVED_PAYMENT_DUE"] },
      },
    }),
    db.stampRequest.count({
      where: {
        restaurant: { ownerId: ctx.user.id },
        status: "PENDING",
      },
    }),
  ]);

  return (
    <AdminLayoutShell
      restaurant={ctx.restaurant}
      user={ctx.user}
      pendingRequestsCount={pendingRequestsCount}
      pendingStampRequestsCount={pendingStampRequestsCount}
    >
      {children}
    </AdminLayoutShell>
  );
}
