import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";

export default function QrPrintPage() {
  const { id = "" } = useParams();
  const [item, setItem] = useState<any>(null);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const db = getFirebaseServices().db;
        const qrSnap = await getDoc(doc(db, "qrCodes", id));
        if (!qrSnap.exists()) throw new Error("QR code not found.");
        const qr = qrSnap.data();
        const restaurantSnap = await getDoc(doc(db, "restaurants", String(qr.restaurantId)));
        if (!restaurantSnap.exists()) throw new Error("Restaurant not found.");
        const restaurant = restaurantSnap.data();
        setItem({ qr, restaurant });
        setImage(
          await QRCode.toDataURL(`${window.location.origin}/r/${qr.slug}`, {
            width: 700,
            margin: 2,
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load this QR code.");
      }
    })();
  }, [id]);

  if (error) return <main className="p-8 text-center text-sm text-red-700">{error}</main>;
  if (!item) return <main className="p-8 text-center text-sm text-[#716B64]">Loading printable card…</main>;

  const { qr, restaurant } = item;
  const brandColor = restaurant.brandColor || "#B58A4B";
  const placement = [qr.location, qr.tableNo ? `Table ${qr.tableNo}` : null]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8 text-[#24211E] print:bg-white print:p-0">
      {/* Top action bar - hidden during print */}
      <div className="mx-auto mb-6 flex max-w-md items-center justify-between gap-3 rounded-xl border border-[#E8DFD1] bg-white p-4 shadow-sm print:hidden">
        <Link to="/dashboard/qr" className="text-xs text-[#716B64] underline">
          ← Back to QR codes
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-xl border border-[#E8DFD1] bg-white px-4 py-2 text-xs font-bold text-[#24211E] transition hover:bg-[#FAF7F2]"
        >
          Print / Save PDF
        </button>
      </div>

      {/* The Printable Table Tent Card */}
      <div className="mx-auto flex justify-center">
        <article
          className="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xl print:m-0 print:w-[360px] print:rounded-2xl print:shadow-none"
        >
          {/* Top Brand Stripe */}
          <div
            className="absolute top-0 left-0 right-0 h-3 rounded-t-3xl print:rounded-t-2xl"
            style={{ backgroundColor: brandColor }}
          />

          {/* Restaurant Name */}
          <div className="pt-4">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={`${restaurant.name} logo`}
                className="mx-auto mb-3 h-12 w-24 rounded-lg border border-zinc-200 bg-[#F7F2E9] p-1 object-contain shadow-sm"
              />
            ) : (
              <div className="mx-auto mb-3 h-12 w-24 rounded-lg bg-[#F7F2E9] flex items-center justify-center">
                <span className="text-xl font-bold text-[#24211E]">
                  {restaurant.name.charAt(0)}
                </span>
              </div>
            )}
            <h1 className="text-3xl font-serif font-bold text-[#24211E] tracking-tight">
              {restaurant.name}
            </h1>
            {placement && (
              <p className="mt-1 text-xs text-[#716B64] font-medium">{placement}</p>
            )}
          </div>

          {/* Call to action */}
          <div className="my-6">
            <p className="text-sm font-medium text-[#24211E]">How was your visit?</p>
            <p className="text-xs text-[#716B64]/60 mt-1">
              Scan to rate and leave your review.
            </p>
          </div>

          {/* QR Code - large and centered */}
          <div className="relative mx-auto my-4 flex w-64 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <img src={image} alt={`QR Code for ${qr.name}`} className="h-48 w-48 object-contain" />
            <span className="mt-2 text-[11px] font-medium text-[#716B64]/80">
              Scan with phone camera
            </span>
          </div>

          {/* Card footer */}
          <div className="mt-8 border-t border-zinc-100 pt-4 text-[10px] text-zinc-400">
            Powered by ReviewFlow
          </div>
        </article>
      </div>
    </div>
  );
}
