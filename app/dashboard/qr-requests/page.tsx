import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQrPricePaise } from "@/lib/plans";
import { QrRequestForm, QrRequestList } from "@/components/QrRequestComponents";

export const dynamic = "force-dynamic";

export default async function QrRequestsPage() {
  const ctx = await getOwnerContext();
  if (!ctx) return null;

  const requests = await db.qrRequest.findMany({
    where: { restaurant: { ownerId: ctx.user.id } },
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
  });

  const serialized = requests.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">QR Requests</h1>
          <p className="mt-1 text-ink/70">
            Request new QR codes. After approval, scan the payment QR and our team will
            verify your payment and activate the QR code.
          </p>
        </div>
        <QrRequestForm />
      </div>

      {/* Flow explanation */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            step: "1",
            title: "Submit Request",
            desc: "Tell us the QR name, location, and how many you need.",
            color: "bg-paper border-line",
          },
          {
            step: "2",
            title: "Admin Approves",
            desc: "Our team reviews and approves your request.",
            color: "bg-amber-50 border-amber-200",
          },
          {
            step: "3",
            title: "Pay by UPI",
            desc: "Scan the payment QR. The administrator verifies payment and activates your QR.",
            color: "bg-emerald-50 border-emerald-200",
          },
        ].map((item) => (
          <div
            key={item.step}
            className={`rounded-xl border p-4 ${item.color}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white text-xs font-bold">
                {item.step}
              </span>
              <p className="font-semibold text-sm">{item.title}</p>
            </div>
            <p className="text-xs text-ink/60">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Your Requests</h2>
        <QrRequestList
          requests={serialized}
          allowTestPayment={process.env.NODE_ENV !== "production"}
          paymentUnitPaise={getQrPricePaise()}
        />
      </div>
    </div>
  );
}
