import { redirect } from "next/navigation";
import { getSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { QrRequestsAdminPanel } from "@/components/QrRequestsAdminPanel";

export const dynamic = "force-dynamic";

export default async function SuperAdminQrRequestsPage({
  searchParams,
}: {
  searchParams?: { filter?: "all" | "pending" | "approved" | "rejected" };
}) {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/login");

  const requestedFilter = searchParams?.filter || "all";
  const filter =
    requestedFilter === "pending"
      ? "PENDING_APPROVAL"
      : requestedFilter === "approved"
        ? "APPROVED_PAYMENT_DUE"
        : requestedFilter === "rejected"
          ? "REJECTED"
          : "all";

  const qrRequests = await db.qrRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: {
        include: { owner: { select: { name: true, email: true } } },
      },
      qrCodes: { select: { id: true, status: true, slug: true } },
      payments: { select: { id: true, status: true, amount: true, method: true, reference: true } },
    },
  });

  const pendingCount = qrRequests.filter((r) => r.status === "PENDING_APPROVAL").length;
  const approvedCount = qrRequests.filter(
    (r) => r.status === "APPROVED_PAYMENT_DUE",
  ).length;
  const rejectedCount = qrRequests.filter((r) => r.status === "REJECTED").length;

  const serializedRequests = qrRequests.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#24211E] flex items-center gap-3">
            QR Requests
            {pendingCount > 0 && (
              <span className="inline-flex h-6 px-2.5 items-center justify-center rounded-full bg-[#B58A4B] text-white text-xs font-bold">
                {pendingCount} Pending
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[#716B64]">
            Review restaurant QR requests. QR codes are created only after payment is confirmed.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Total</span>
            <span className="font-bold text-[#24211E]">{qrRequests.length}</span>
          </div>
          <div className="rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#B58A4B] block font-medium">Pending</span>
            <span className="font-bold text-[#B58A4B]">{pendingCount}</span>
          </div>
          <div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center shadow-xs">
            <span className="text-[#716B64] block">Approved</span>
            <span className="font-semibold text-[#24211E]">{approvedCount}</span>
          </div>
          {rejectedCount > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-center shadow-xs">
              <span className="text-rose-800/70 block">Rejected</span>
              <span className="font-semibold text-rose-900">{rejectedCount}</span>
            </div>
          )}
        </div>
      </div>

      <QrRequestsAdminPanel requests={serializedRequests} filter={filter} />
    </div>
  );
}
