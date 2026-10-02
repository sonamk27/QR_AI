import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SuperAdminLayoutShell } from "@/components/super-admin/SuperAdminLayoutShell";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  // Pending QR requests count for badge
  const pendingCount = await db.qrRequest.count({ where: { status: "PENDING_APPROVAL" } });

  return (
    <SuperAdminLayoutShell admin={admin} pendingRequestsCount={pendingCount}>
      {children}
    </SuperAdminLayoutShell>
  );
}
