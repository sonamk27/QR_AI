import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import QRCode from "qrcode";
import { buildUpiPaymentUri } from "../../lib/upi-payment";
import { getFirebaseServices } from "./firebase";

export type PaymentMethod = "UPI" | "BANK";

export function getFirebaseQrPricePaise() {
  const configured = import.meta.env.VITE_QR_PRICE_PAISE;
  const amount = configured ? Number(configured) : 99_900;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("VITE_QR_PRICE_PAISE must be a positive integer amount in paise.");
  return amount;
}

export async function createFirebaseUpiQr(amountPaise: number, requestId: string) {
  const payeeVpa = import.meta.env.VITE_UPI_VPA?.trim();
  if (!payeeVpa) throw new Error("UPI payments are not configured. Contact the administrator.");
  const paymentUri = buildUpiPaymentUri({
    payeeVpa,
    payeeName: import.meta.env.VITE_UPI_PAYEE_NAME?.trim() || "ReviewFlow",
    amountPaise,
    requestId,
  });
  return QRCode.toDataURL(paymentUri, { width: 640, margin: 2, errorCorrectionLevel: "M" });
}

export async function submitQrPaymentReference(input: {
  ownerUid: string;
  requestId: string;
  pendingPaymentId: string | null;
  reference: string;
  method: PaymentMethod;
}) {
  const reference = input.reference.trim();
  if (!reference || reference.length > 120) throw new Error("Enter a payment reference up to 120 characters.");
  const { db } = getFirebaseServices();
  const requestRef = doc(db, "qrRequests", input.requestId);
  const paymentRef = doc(db, "payments", input.pendingPaymentId ?? `owner_${input.requestId}`);
  const auditRef = doc(collection(db, "auditLogs"));
  await runTransaction(db, async (tx) => {
    const [requestSnap, paymentSnap] = await Promise.all([tx.get(requestRef), tx.get(paymentRef)]);
    if (!requestSnap.exists() || requestSnap.data().ownerUid !== input.ownerUid) throw new Error("QR request not found.");
    const request = requestSnap.data();
    if (request.status !== "APPROVED_PAYMENT_DUE") throw new Error("This request is not awaiting payment.");
    if (paymentSnap.exists() && paymentSnap.data().status !== "PENDING") {
      throw new Error("A payment reference is already submitted or the payment is complete.");
    }
    const amount = getFirebaseQrPricePaise() * Number(request.quantity ?? 1);
    if (!Number.isSafeInteger(amount)) throw new Error("Payment amount is out of range.");
    const fields = {
      amount,
      method: input.method,
      reference,
      status: "RECORDED",
      gatewayOrderId: null,
      gatewayPaymentId: null,
    };
    if (paymentSnap.exists()) tx.update(paymentRef, fields);
    else tx.set(paymentRef, {
      id: paymentRef.id,
      ownerUid: input.ownerUid,
      restaurantId: String(request.restaurantId),
      qrRequestId: input.requestId,
      currency: "INR",
      ...fields,
      createdAt: serverTimestamp(),
    });
    tx.set(auditRef, {
      id: auditRef.id,
      actorUid: input.ownerUid,
      ownerUid: input.ownerUid,
      action: "payment.utr_submitted",
      target: paymentRef.id,
      restaurantId: String(request.restaurantId),
      meta: { qrRequestId: input.requestId, amount, reference, method: input.method },
      createdAt: serverTimestamp(),
    });
  });
}
