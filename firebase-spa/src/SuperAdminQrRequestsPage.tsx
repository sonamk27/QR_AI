import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collection, deleteField, doc, getDocs, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { QrRequestsAdminPanel } from "../../components/QrRequestsAdminPanel";
import { getFirebaseServices } from "./firebase";
import { getFirebaseQrPricePaise } from "./paymentActions";
import { useAuthState } from "./AuthState";
import { getBusinessType, type BusinessType } from "../../lib/business-type";

type AdminRequest = {
  id: string; name: string; location?: string | null; tableNo?: string | null; quantity: number;
  note?: string | null; status: "PENDING_APPROVAL" | "APPROVED_PAYMENT_DUE" | "PAID" | "ACTIVE" | "REJECTED";
  rejectionReason?: string | null; createdAt: string; reviewedAt?: string | null;
  ownerUid: string;
  restaurant: { id: string; name: string; businessType: BusinessType; city?: string | null; owner: { name: string; email: string } };
  qrCodes: { id: string; status: string; slug: string }[];
  payments: { id: string; status: string; amount: number; method: string; reference: string }[];
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate();
  return null;
}

export default function SuperAdminQrRequestsPage() {
  const { user } = useAuthState();
  const [search] = useSearchParams();
  const filter = search.get("filter") === "pending" ? "PENDING_APPROVAL"
    : search.get("filter") === "approved" ? "APPROVED_PAYMENT_DUE"
      : search.get("filter") === "rejected" ? "REJECTED" : "all";
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { db } = getFirebaseServices();
      const [requestSnap, restaurantSnap, userSnap, qrSnap, paymentSnap] = await Promise.all([
        getDocs(collection(db, "qrRequests")),
        getDocs(collection(db, "restaurants")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "qrCodes")),
        getDocs(collection(db, "payments")),
      ]);
      const restaurants = new Map(restaurantSnap.docs.map((item) => [item.id, item.data()]));
      const users = new Map(userSnap.docs.map((item) => [item.id, item.data()]));
      const qrsByRequest = new Map<string, AdminRequest["qrCodes"]>();
      for (const item of qrSnap.docs) {
        const row = item.data();
        if (!row.qrRequestId) continue;
        const list = qrsByRequest.get(row.qrRequestId) ?? [];
        list.push({ id: item.id, status: String(row.status ?? ""), slug: String(row.slug ?? "") });
        qrsByRequest.set(row.qrRequestId, list);
      }
      const paymentsByRequest = new Map<string, AdminRequest["payments"]>();
      for (const item of paymentSnap.docs) {
        const row = item.data();
        if (!row.qrRequestId) continue;
        const list = paymentsByRequest.get(row.qrRequestId) ?? [];
        list.push({ id: item.id, status: String(row.status ?? ""), amount: Number(row.amount ?? 0), method: String(row.method ?? ""), reference: String(row.reference ?? "") });
        paymentsByRequest.set(row.qrRequestId, list);
      }
      const mapped: AdminRequest[] = requestSnap.docs.map((item) => {
        const row = item.data();
        const restaurant = restaurants.get(String(row.restaurantId)) ?? {};
        const owner = users.get(String(restaurant.ownerUid)) ?? {};
        return {
          id: item.id, name: String(row.name ?? ""), location: row.location ?? null,
          tableNo: row.tableNo ?? null, quantity: Number(row.quantity ?? 1), note: row.note ?? null,
          status: row.status as AdminRequest["status"], rejectionReason: row.rejectionReason ?? null,
          createdAt: asDate(row.createdAt)?.toISOString() ?? new Date(0).toISOString(),
          reviewedAt: asDate(row.reviewedAt)?.toISOString() ?? null,
          ownerUid: String(row.ownerUid ?? ""),
          restaurant: { id: String(row.restaurantId), name: String(restaurant.name ?? "Unknown business"), businessType: getBusinessType(restaurant.businessType), city: restaurant.city ?? null,
            owner: { name: String(owner.name ?? ""), email: String(owner.email ?? "") } },
          qrCodes: qrsByRequest.get(item.id) ?? [], payments: paymentsByRequest.get(item.id) ?? [],
        };
      }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setRequests(mapped);
    } catch (caught) {
      console.error("Super Admin QR requests could not be loaded", caught);
      setError("Could not load QR requests. Confirm Firestore access rules and imported records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function auditData(action: string, requestId: string, restaurantId: string, meta: Record<string, unknown>) {
    const { db } = getFirebaseServices();
    const ref = doc(collection(db, "auditLogs"));
    return { ref, data: { id: ref.id, actorUid: user?.uid, ownerUid: requests.find((row) => row.id === requestId)?.ownerUid ?? null, action, target: requestId, restaurantId, meta, createdAt: serverTimestamp() } };
  }

  async function approve(requestId: string) {
    if (!user) throw new Error("Sign in again and retry.");
    const requestRef = doc(getFirebaseServices().db, "qrRequests", requestId);
    const request = requests.find((row) => row.id === requestId);
    if (!request) throw new Error("QR request not found.");
    const { ref: auditRef, data: audit } = auditData("qr_request.approved", requestId, request.restaurant.id, { quantity: request.quantity });
    await runTransaction(getFirebaseServices().db, async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists() || snap.data().status !== "PENDING_APPROVAL") throw new Error("Only pending-approval requests can be approved.");
      tx.update(requestRef, { status: "APPROVED_PAYMENT_DUE", reviewedByUid: user.uid, reviewedAt: serverTimestamp() });
      tx.set(auditRef, audit);
    });
  }

  async function reject(requestId: string, reason: string) {
    if (!user) throw new Error("Sign in again and retry.");
    const request = requests.find((row) => row.id === requestId);
    if (!request) throw new Error("QR request not found.");
    const { db } = getFirebaseServices();
    const requestRef = doc(db, "qrRequests", requestId);
    const restaurantRef = doc(db, "restaurants", request.restaurant.id);
    const qrRefs = request.qrCodes.map((qr) => doc(db, "qrCodes", qr.id));
    const { ref: auditRef, data: audit } = auditData("qr_request.rejected", requestId, request.restaurant.id, { reason });
    await runTransaction(db, async (tx) => {
      const reads = await Promise.all([tx.get(requestRef), tx.get(restaurantRef), ...qrRefs.map((ref) => tx.get(ref))]);
      const requestSnap = reads[0];
      const restaurantSnap = reads[1];
      if (!requestSnap.exists() || requestSnap.data().status !== "PENDING_APPROVAL") throw new Error("Only pending-approval requests can be rejected.");
      if (!restaurantSnap.exists() || restaurantSnap.data().ownerUid !== request.ownerUid) throw new Error("Restaurant ownership could not be verified.");
      tx.update(requestRef, { status: "REJECTED", rejectionReason: reason.trim(), reviewedByUid: user.uid, reviewedAt: serverTimestamp() });
      if (restaurantSnap.data().openQrRequestId === requestId) tx.update(restaurantRef, { openQrRequestId: deleteField() });
      for (let index = 0; index < qrRefs.length; index++) {
        const qrSnap = reads[index + 2];
        if (qrSnap.exists() && qrSnap.data().status === "PENDING_PAYMENT") tx.delete(qrRefs[index]);
      }
      tx.set(auditRef, audit);
    });
  }

  async function verifyPayment(requestId: string) {
    if (!user) throw new Error("Sign in again and retry.");
    const request = requests.find((row) => row.id === requestId);
    if (!request) throw new Error("QR request not found.");
    const { db } = getFirebaseServices();
    const requestRef = doc(db, "qrRequests", requestId);
    const restaurantRef = doc(db, "restaurants", request.restaurant.id);
    const qrRefs = request.qrCodes.map((qr) => doc(db, "qrCodes", qr.id));
    if (!qrRefs.length) throw new Error("No locked QR code is attached to this request.");
    const year = new Date().getFullYear();
    const counterRef = doc(db, "invoiceCounters", String(year));
    const existingPayment = request.payments.find((payment) => payment.status === "RECORDED")
      ?? request.payments.find((payment) => payment.status === "PENDING");
    const paymentRef = existingPayment ? doc(db, "payments", existingPayment.id) : doc(collection(db, "payments"));
    const amount = getFirebaseQrPricePaise() * request.quantity;
    if (!Number.isSafeInteger(amount)) throw new Error("Payment amount is out of range.");
    const { ref: auditRef, data: audit } = auditData("payment.manual_qr_verified", requestId, request.restaurant.id, { qrCount: request.quantity, amount, paymentMethod: "UPI" });
    await runTransaction(db, async (tx) => {
      const reads = await Promise.all([tx.get(requestRef), tx.get(restaurantRef), tx.get(counterRef), tx.get(paymentRef), ...qrRefs.map((ref) => tx.get(ref))]);
      const requestSnap = reads[0];
      const restaurantSnap = reads[1];
      const counterSnap = reads[2];
      const paymentSnap = reads[3];
      if (!requestSnap.exists() || requestSnap.data().status !== "APPROVED_PAYMENT_DUE") throw new Error("Only approved requests can be verified.");
      if (!restaurantSnap.exists() || restaurantSnap.data().ownerUid !== request.ownerUid || restaurantSnap.data().primaryQrId) throw new Error("Restaurant QR activation state changed. Reload the page.");
      const qrSnapshots = reads.slice(4);
      if (qrSnapshots.some((snap) => !snap.exists() || snap.data().status !== "PENDING_PAYMENT")) throw new Error("A locked QR code could not be verified.");
      if (paymentSnap.exists() && !["RECORDED", "PENDING"].includes(String(paymentSnap.data().status))) throw new Error("The payment was already processed. Reload the page.");
      const nextInvoice = Number(counterSnap.data()?.value ?? 0) + 1;
      const invoiceNo = `RF-${year}-${String(nextInvoice).padStart(5, "0")}`;
      const paymentData = paymentSnap.data();
      const now = new Date();
      const validUntil = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      tx.set(counterRef, { value: nextInvoice, updatedAt: serverTimestamp() }, { merge: true });
      tx.set(paymentRef, {
        id: paymentRef.id, ownerUid: request.ownerUid, restaurantId: request.restaurant.id,
        qrId: qrRefs[0].id, qrRequestId: requestId, amount, currency: "INR", status: "PAID",
        invoiceNo, method: paymentData?.method ?? "UPI",
        reference: paymentData?.status === "RECORDED" ? paymentData.reference : `MANUAL-${requestId}`,
        recordedByUid: user.uid,
        createdAt: serverTimestamp(), gatewayOrderId: null, gatewayPaymentId: null,
      }, { merge: true });
      tx.update(requestRef, { status: "ACTIVE", reviewedByUid: user.uid, reviewedAt: serverTimestamp() });
      for (let index = 0; index < qrRefs.length; index++) {
        const qr = qrSnapshots[index].data();
        if (!qr?.slug) throw new Error("A locked QR code is missing its public link.");
        tx.update(qrRefs[index], { status: "ACTIVE", validFrom: now, validUntil });
        tx.set(doc(db, "publicQrPages", String(qr.slug)), {
          qrId: qrRefs[index].id, ownerUid: request.ownerUid, restaurantId: request.restaurant.id,
          slug: String(qr.slug), status: "ACTIVE", validUntil,
        });
      }
      tx.update(restaurantRef, { primaryQrId: qrRefs[0].id, openQrRequestId: deleteField() });
      tx.set(auditRef, { ...audit, invoiceNo });
    });
  }

  const pendingCount = requests.filter((request) => request.status === "PENDING_APPROVAL").length;
  const approvedCount = requests.filter((request) => request.status === "APPROVED_PAYMENT_DUE").length;
  const rejectedCount = requests.filter((request) => request.status === "REJECTED").length;
  return <div className="space-y-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="flex items-center gap-3 font-serif text-3xl font-bold tracking-tight text-[#24211E]">QR Requests{pendingCount > 0 && <span className="inline-flex h-6 items-center justify-center rounded-full bg-[#B58A4B] px-2.5 text-xs font-bold text-white">{pendingCount} Pending</span>}</h1><p className="mt-1 text-sm text-[#716B64]">Review restaurant QR requests. QR codes are activated after payment is confirmed.</p></div>
      <div className="flex gap-2 text-xs"><div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center"><span className="block text-[#716B64]">Total</span><span className="font-bold">{requests.length}</span></div><div className="rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] px-3.5 py-1.5 text-center"><span className="block text-[#B58A4B]">Pending</span><span className="font-bold text-[#B58A4B]">{pendingCount}</span></div><div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center"><span className="block text-[#716B64]">Approved</span><span className="font-semibold">{approvedCount}</span></div>{rejectedCount > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-center"><span className="block text-rose-800/70">Rejected</span><span className="font-semibold text-rose-900">{rejectedCount}</span></div>}</div>
    </div>
    <div className="flex items-center justify-between"><div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{loading && <p className="text-sm text-[#716B64]">Loading requests…</p>}</div><button onClick={() => void load()} className="text-xs font-semibold text-[#7A5826] underline">Refresh</button></div>
    {!loading && <QrRequestsAdminPanel requests={requests} filter={filter} firebaseActions={{ approve, reject, verifyPayment, onChanged: load }} />}
  </div>;
}
