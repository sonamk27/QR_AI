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
              Submit the UTR for your UPI or bank transfer for admin verification.
            </p>
          </div>
          <QrRequestList
            requests={serializedRequests}
            allowTestPayment={process.env.NODE_ENV !== "production"}
            paymentUnitPaise={getQrPricePaise()}
            upiVpa={process.env.UPI_VPA?.trim() ?? ""}
            upiPayeeName={process.env.UPI_PAYEE_NAME?.trim() || "ReviewFlow"}
          />
        </section>
      )}
    </div>
  );
}
