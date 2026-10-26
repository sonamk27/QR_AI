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
      <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-base font-bold text-[#24211E]">How QR setup works</h2>
          <p className="text-xs text-[#716B64]">Your request stays visible here at every step.</p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[#E8DFD1] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          {
            step: "1",
            title: "Submit Request",
            desc: "Add a name and tell us where you plan to place it.",
          },
          {
            step: "2",
            title: "Request Review",
            desc: "We review your request and update its status here.",
          },
          {
            step: "3",
            title: "Pay by UPI",
            desc: "Pay by UPI after approval. Your QR activates once payment is verified.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-1 sm:first:pl-0 sm:last:pr-0"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E8D8BA] bg-[#FAF5ED] text-xs font-bold text-[#7A5826]">
                {item.step}
              </span>
              <div>
              <p className="text-sm font-semibold text-[#24211E]">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#716B64]">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
        </div>
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
