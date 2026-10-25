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
        select: {
          id: true,
          name: true,
          city: true,
          owner: {
            select: { name: true, email: true },
          },
        },
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
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#24211E]">Payment Ledger</h1>
          <p className="mt-1 text-sm text-[#716B64]">
            All subscription payments, bank transfers, UPI records, and automatic gateway invoices.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Total Collected</span>
            <span className="font-bold text-[#B58A4B]">{rupees(totalPaise)}</span>
          </div>
          <div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Direct (UPI/Bank)</span>
            <span className="font-bold text-[#24211E]">{directCount}</span>
          </div>
          <div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Gateway</span>
            <span className="font-bold text-[#24211E]">{gatewayCount}</span>
          </div>
        </div>
      </div>

      <PaymentsAdminTable payments={serialized} />
    </div>
  );
}
