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

  const serialized = requests.map((r: any) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-[#E8DFD1] pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#24211E]">QR Code Requests</h1>
          <p className="mt-1 text-xs text-[#716B64]">
            Request new QR codes. After approval, scan the payment QR and our team will
            verify your payment and activate your QR code.
          </p>
        </div>
        <QrRequestForm />
      </div>

      {/* Flow explanation */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            step: "1",
            title: "Submit Request",
            desc: "Tell us the QR name, location, and placement details.",
            color: "bg-white border-[#E8DFD1]",
          },
          {
            step: "2",
            title: "Admin Approves",
            desc: "Our platform team reviews and approves your request.",
            color: "bg-[#FAF5ED] border-[#E8D8BA]",
          },
          {
            step: "3",
            title: "Pay by UPI",
            desc: "Scan the payment QR. Administrator verifies and activates your code.",
            color: "bg-[#EEF6F2] border-[#D1E7DC]",
          },
        ].map((item) => (
          <div
            key={item.step}
            className={`rounded-2xl border p-5 shadow-subtle ${item.color}`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#24211E] text-white text-xs font-bold">
                {item.step}
              </span>
              <p className="font-serif font-bold text-sm text-[#24211E]">{item.title}</p>
            </div>
            <p className="text-xs text-[#716B64] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-[#24211E]">Your Requests</h2>
        <QrRequestList
          requests={serialized}
          allowTestPayment={process.env.NODE_ENV !== "production"}
          paymentUnitPaise={getQrPricePaise()}
        />
      </div>
    </div>
  );
}
