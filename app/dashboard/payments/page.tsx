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
    .filter((p) => p.status === "PAID" || p.status === "CONFIRMED")
    .reduce((sum, p) => sum + p.amount, 0);

  const serialized = payments.map((p) => ({
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
  const serializedRequests = approvedRequests.map((request) => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Payment History &amp; Invoices</h1>
        <p className="mt-1 text-ink/70">
          Track all subscription payments, download printable receipts, and review renewal records.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Total Paid"
          value={rupees(totalPaisePaid)}
          hint="Across all subscriptions"
        />
        <Stat
          label="Invoices"
          value={payments.length}
          hint={`${payments.filter((p) => p.status === "PAID" || p.status === "CONFIRMED").length} completed`}
        />
        <Stat
          label="Active Subscriptions"
          value={activeQrCount}
          hint="Live 365-day QR licenses"
        />
      </div>

      {/* Billing Support & Inquiries Contact Card */}
      <div className="rounded-2xl border border-line bg-paper/50 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf/10 text-leaf">
              <span className="text-xl">💳</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Payment &amp; Billing Contact Desk</h2>
              <p className="text-xs text-ink/70">
                Have questions regarding your invoices, GST billing, payment verification, or license renewals?
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="mailto:billing@reviewflow.in"
              className="btn-ghost flex items-center gap-1.5 !py-1.5 text-xs text-ink"
            >
              <span>✉️</span>
              <span>billing@reviewflow.in</span>
            </a>
            <a
              href="tel:+919876543210"
              className="btn-ghost flex items-center gap-1.5 !py-1.5 text-xs text-ink"
            >
              <span>📞</span>
              <span>+91 98765 43210</span>
            </a>
            <a
              href="https://wa.me/919876543210?text=Hi%20ReviewFlow,%20I%20have%20an%20inquiry%20regarding%20my%20payment%20and%20invoice."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost flex items-center gap-1.5 !py-1.5 text-xs text-emerald-700"
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
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">Approved QR requests</h2>
            <p className="mt-1 text-sm text-ink/70">
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
