import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { QrRequestForm, QrRequestList } from "../../components/QrRequestComponents";
import { getFirebaseServices } from "./firebase";
import { createFirebaseUpiQr, getFirebaseQrPricePaise, submitQrPaymentReference } from "./paymentActions";
import { useAuthState } from "./AuthState";
import { useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "./DashboardShell";

type RequestCard = {
  id: string; name: string; location?: string | null; tableNo?: string | null; quantity: number;
  note?: string | null; status: "PENDING_APPROVAL" | "APPROVED_PAYMENT_DUE" | "PAID" | "ACTIVE" | "REJECTED";
  rejectionReason?: string | null; createdAt: string; restaurant?: { name: string };
  qrCodes: { id: string; slug: string; status: string }[];
  payments: { id: string; status: string; amount: number; method?: string; reference?: string }[];
};

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate();
  return new Date(0);
}

export default function QrRequestsPage() {
  const { user } = useAuthState();
  const { restaurant, restaurantId } = useOutletContext<DashboardOutletContext>();
  const [requests, setRequests] = useState<RequestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const { db } = getFirebaseServices();
      const [requestSnap, qrSnap, paymentSnap] = await Promise.all([
        getDocs(query(collection(db, "qrRequests"), where("ownerUid", "==", user.uid))),
        getDocs(query(collection(db, "qrCodes"), where("ownerUid", "==", user.uid))),
        getDocs(query(collection(db, "payments"), where("ownerUid", "==", user.uid))),
      ]);
      const qrsByRequest = new Map<string, RequestCard["qrCodes"]>();
      for (const item of qrSnap.docs) {
        const row = item.data();
        if (!row.qrRequestId) continue;
        const list = qrsByRequest.get(row.qrRequestId) ?? [];
        list.push({ id: item.id, slug: String(row.slug ?? ""), status: String(row.status ?? "PENDING_PAYMENT") });
        qrsByRequest.set(row.qrRequestId, list);
      }
      const paymentsByRequest = new Map<string, RequestCard["payments"]>();
      for (const item of paymentSnap.docs) {
        const row = item.data();
        if (!row.qrRequestId) continue;
        const list = paymentsByRequest.get(row.qrRequestId) ?? [];
        list.push({ id: item.id, status: String(row.status ?? ""), amount: Number(row.amount ?? 0), method: row.method, reference: row.reference });
        paymentsByRequest.set(row.qrRequestId, list);
      }
      const mapped = requestSnap.docs.map((item) => {
        const row = item.data();
        return {
          id: item.id, name: String(row.name ?? ""), location: row.location ?? null,
          tableNo: row.tableNo ?? null, quantity: Number(row.quantity ?? 1), note: row.note ?? null,
          status: row.status as RequestCard["status"], rejectionReason: row.rejectionReason ?? null,
          createdAt: toDate(row.createdAt).toISOString(), restaurant: restaurant ? { name: restaurant.name } : undefined,
          qrCodes: qrsByRequest.get(item.id) ?? [], payments: paymentsByRequest.get(item.id) ?? [],
        } satisfies RequestCard;
      }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setRequests(mapped);
    } catch (caught) {
      console.error("QR requests could not be loaded", caught);
      setError("Could not load your QR requests. Check your Firestore access rules.");
    } finally {
      setLoading(false);
    }
  }, [user, restaurant]);

  useEffect(() => { void load(); }, [load]);

  async function createRequest(values: { name: string; location: string; tableNo: string; quantity: number; note: string }) {
    if (!user || !restaurantId) throw new Error("Restaurant profile is still loading.");
    const name = values.name.trim();
    const location = values.location.trim();
    const tableNo = values.tableNo.trim();
    const note = values.note.trim();
    if (!name || name.length > 60 || location.length > 60 || tableNo.length > 20 || note.length > 500) {
      throw new Error("Check the request details and try again.");
    }
    const { db } = getFirebaseServices();
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const requestRef = doc(collection(db, "qrRequests"));
    const qrRef = doc(collection(db, "qrCodes"));
    const slug = crypto.randomUUID().replaceAll("-", "");

    await runTransaction(db, async (transaction) => {
      const restaurantSnap = await transaction.get(restaurantRef);
      if (!restaurantSnap.exists()) throw new Error("Restaurant profile was not found.");
      const restaurantData = restaurantSnap.data();
      if (restaurantData.ownerUid !== user.uid) throw new Error("You do not manage this restaurant.");
      if (restaurantData.primaryQrId) throw new Error("This restaurant already has a QR code. Only one primary QR is allowed.");
      if (restaurantData.openQrRequestId) throw new Error("A QR request is already awaiting review or payment.");

      transaction.set(requestRef, {
        id: requestRef.id,
        ownerUid: user.uid,
        restaurantId,
        name,
        location: location || null,
        tableNo: tableNo || null,
        quantity: 1,
        qrCodeIds: [qrRef.id],
        note: note || null,
        status: "PENDING_APPROVAL",
        createdAt: serverTimestamp(),
      });
      transaction.set(qrRef, {
        id: qrRef.id,
        ownerUid: user.uid,
        restaurantId,
        qrRequestId: requestRef.id,
        name,
        location: location || null,
        tableNo: tableNo || null,
        slug,
        status: "PENDING_PAYMENT",
        createdAt: serverTimestamp(),
      });
      transaction.update(restaurantRef, { openQrRequestId: requestRef.id });
    });
  }

  async function submitPaymentReference(requestId: string, pendingPaymentId: string | null, reference: string, method: "UPI" | "BANK") {
    if (!user) throw new Error("Sign in again and retry.");
    await submitQrPaymentReference({ ownerUid: user.uid, requestId, pendingPaymentId, reference, method });
    await load();
  }

  return <div className="space-y-7">
    <div className="flex flex-col gap-4 border-b border-[#E8DFD1] pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="font-serif text-3xl font-bold text-[#24211E]">QR Code Requests</h1><p className="mt-1 text-xs text-[#716B64]">Generate your QR when you submit a request. It stays locked on your QR page until our team approves the request and verifies your payment.</p></div>
      <QrRequestForm onSubmitFirebase={createRequest} onSaved={load} />
    </div>
    <div className="rounded-2xl border border-[#E8DFD1] bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><h2 className="font-serif text-base font-bold text-[#24211E]">How QR setup works</h2><p className="text-xs text-[#716B64]">Your request stays visible here at every step.</p></div>
      <div className="grid grid-cols-1 divide-y divide-[#E8DFD1] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { step: "1", title: "Submit Request", desc: "Your QR is generated immediately and shown as locked on your QR page." },
          { step: "2", title: "Request Review", desc: "We review your request and update its status here." },
          { step: "3", title: "Pay by UPI", desc: "Pay in person after approval. Your QR unlocks as soon as payment is verified." },
        ].map((item) => <div key={item.step} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-1 sm:first:pl-0 sm:last:pr-0"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E8D8BA] bg-[#FAF5ED] text-xs font-bold text-[#7A5826]">{item.step}</span><div><p className="text-sm font-semibold text-[#24211E]">{item.title}</p><p className="mt-0.5 text-xs leading-relaxed text-[#716B64]">{item.desc}</p></div></div>)}
      </div>
    </div>
    <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-serif text-xl font-bold text-[#24211E]">Your Requests</h2><button onClick={() => void load()} className="text-xs font-semibold text-[#7A5826] underline">Refresh</button></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{loading ? <p className="text-sm text-[#716B64]">Loading requests…</p> : <QrRequestList requests={requests} allowTestPayment={false} paymentUnitPaise={getFirebaseQrPricePaise()} onSubmitPaymentFirebase={submitPaymentReference} createPaymentQrFirebase={createFirebaseUpiQr} />}</div>
  </div>;
}
