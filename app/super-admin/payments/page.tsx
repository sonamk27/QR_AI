import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupees } from "@/lib/plans";
import { PaymentsAdminTable } from "@/components/PaymentsAdminTable";

export const dynamic = "force-dynamic";

export default async function SuperAdminPaymentsPage() {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: {
        select: { id: true, name: true, city: true },
      },
      qr: { select: { name: true } },
      qrRequest: { select: { name: true } },
      recordedBy: { select: { name: true } },
    },
  });

  const totalPaise = payments
    .filter((p) => p.status === "CONFIRMED" || p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  const directCount = payments.filter((p) => p.method !== "GATEWAY").length;
  const gatewayCount = payments.filter((p) => p.method === "GATEWAY").length;

  const serialized = payments.map((p) => ({
    id: p.id,
    invoiceNo: p.invoiceNo,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    status: p.status,
    gatewayOrderId: p.gatewayOrderId,
    createdAt: p.createdAt.toISOString(),
    restaurant: p.restaurant,
    qr: p.qr,
    qrRequest: p.qrRequest,
    qrRequestId: p.qrRequestId,
    recordedBy: p.recordedBy,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Payment Ledger</h1>
          <p className="mt-1 text-sm text-ink/70">
            Comprehensive audit of all direct UPI, cash, bank, and online payments across the platform.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-lg border border-line bg-white px-3 py-1.5 text-center">
            <span className="text-ink/60 block">Transactions</span>
            <span className="font-semibold text-ink">{payments.length}</span>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center">
            <span className="text-emerald-800/70 block">Total Revenue</span>
            <span className="font-semibold text-emerald-900">{rupees(totalPaise)}</span>
          </div>
          <div className="rounded-lg border border-line bg-white px-3 py-1.5 text-center">
            <span className="text-ink/60 block">Direct / Gateway</span>
            <span className="font-semibold text-ink">
              {directCount} / {gatewayCount}
            </span>
          </div>
        </div>
      </div>

      <PaymentsAdminTable payments={serialized} />
    </div>
  );
}
