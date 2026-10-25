import { redirect } from "next/navigation";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQrPricePaise, rupees } from "@/lib/plans";
import { Stat } from "@/components/Shell";
import { OwnerPaymentsClientTable } from "@/components/OwnerPaymentsClientTable";
import { QrRequestList } from "@/components/QrRequestComponents";

export const dynamic = "force-dynamic";

export default async function DashboardPaymentsPage() {
  const ctx = await getOwnerContext();
  if (!ctx) redirect("/login");

  const [payments, activeQrCount, approvedRequests] = await Promise.all([
    db.payment.findMany({
      where: { restaurantId: ctx.restaurant.id },
      orderBy: { createdAt: "desc" },
      include: {
        qr: { select: { name: true } },
        qrRequest: { select: { name: true } },
      },
    }),
    db.qrCode.count({
      where: { restaurantId: ctx.restaurant.id, status: "ACTIVE" },
    }),
    db.qrRequest.findMany({
      where: {
        restaurant: { ownerId: ctx.user.id },
        status: "APPROVED_PAYMENT_DUE",
        payments: { none: { status: "PAID" } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: { select: { name: true } },
        qrCodes: { select: { id: true, slug: true, status: true } },
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
            method: true,
            reference: true,
          },
        },
      },
    }),
  ]);

  const totalPaisePaid = payments
    .filter((p: any) => p.status === "PAID" || p.status === "CONFIRMED")
    .reduce((sum: number, p: any) => sum + p.amount, 0);

  const serialized = payments.map((p: any) => ({
    id: p.id,
    invoiceNo: p.invoiceNo,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    status: p.status,
    gatewayOrderId: p.gatewayOrderId,
    createdAt: p.createdAt.toISOString(),
    qrName: p.qr?.name ?? null,
    qrRequestName: p.qrRequest?.name ?? null,
  }));
  const serializedRequests = approvedRequests.map((request: any) => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-7">
      <div className="border-b border-[#E8DFD1] pb-4">
        <h1 className="font-serif text-3xl font-bold text-[#24211E]">Payment History &amp; Invoices</h1>
        <p className="mt-1 text-xs text-[#716B64]">
          Track all subscription payments, download printable receipts, and review renewal records.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Total Paid"
          value={rupees(totalPaisePaid)}
          hint="Across all subscriptions"
        />
        <Stat
          label="Invoices"
          value={payments.length}
          hint={`${payments.filter((p: any) => p.status === "PAID" || p.status === "CONFIRMED").length} completed`}
        />
        <Stat
          label="Active Subscriptions"
          value={activeQrCount}
          hint="Live 365-day QR licenses"
        />
      </div>

      {/* Billing Support Contact Card */}
      <div className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-subtle">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FAF5ED] text-[#B58A4B] border border-[#E8D8BA]">
              <span className="text-xl">💳</span>
            </div>
            <div>
              <h2 className="font-serif text-sm font-bold text-[#24211E]">Payment &amp; Billing Support Desk</h2>
              <p className="text-xs text-[#716B64]">
                Questions regarding your invoices, GST billing, payment verification, or license renewals?
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="mailto:billing@reviewflow.in"
              className="rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-[#24211E] hover:bg-[#F4ECE1] transition flex items-center gap-1.5"
            >
              <span>✉️</span>
              <span>billing@reviewflow.in</span>
            </a>
            <a
              href="tel:+919876543210"
              className="rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-[#24211E] hover:bg-[#F4ECE1] transition flex items-center gap-1.5"
            >
              <span>📞</span>
              <span>+91 98765 43210</span>
            </a>
            <a
              href="https://wa.me/919876543210?text=Hi%20ReviewFlow,%20I%20have%20an%20inquiry%20regarding%20my%20payment%20and%20invoice."
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-[#D1E7DC] bg-[#EEF6F2] px-3 py-1.5 text-xs font-bold text-[#2E6B4F] hover:bg-[#E2F0E8] transition flex items-center gap-1.5"
            >
              <span>💬</span>
              <span>WhatsApp Desk</span>
            </a>
          </div>
        </div>
      </div>

      <OwnerPaymentsClientTable
        payments={serialized}
        restaurantName={ctx.restaurant.name}
        restaurantCity={ctx.restaurant.city}
        ownerName={ctx.user.name}
        ownerEmail={ctx.user.email}
      />
      {serializedRequests.length > 0 && (
        <section className="space-y-3 pt-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#24211E]">Approved QR requests</h2>
            <p className="mt-1 text-xs text-[#716B64]">
              Scan the payment QR. The administrator will verify payment and activate your QR request.
            </p>
          </div>
          <QrRequestList
            requests={serializedRequests}
            allowTestPayment={process.env.NODE_ENV !== "production"}
            paymentUnitPaise={getQrPricePaise()}
          />
        </section>
      )}
    </div>
  );
}
