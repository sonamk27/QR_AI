import { useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { CustomerJourneyView } from "../../components/customer/CustomerJourneyView";
import { getFirebaseServices } from "./firebase";
import { resolveQrStatus } from "./qrStatus";

export default function PublicQrPage() {
  const { slug = "" } = useParams(); const [search] = useSearchParams(); const location = useLocation();
  const [page, setPage] = useState<any>(null); const [loading, setLoading] = useState(true); const [unavailable, setUnavailable] = useState(false); const [error, setError] = useState("");
  useEffect(() => { let live = true; let stage = "Firebase setup"; setLoading(true); setPage(null); setUnavailable(false); setError(""); void (async () => { try {
    const { auth, db } = getFirebaseServices();
    stage = "guest sign-in";
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    stage = "QR lookup";
    const qrDoc = await getDoc(doc(db, "publicQrPages", slug));
    if (!qrDoc.exists()) { if (live) setUnavailable(true); return; }
    const qr = qrDoc.data();
    if (!["ACTIVE", "GRACE"].includes(resolveQrStatus(String(qr.status), qr.validUntil?.toDate?.() ?? null))) { if (live) setUnavailable(true); return; }
    stage = "business profile lookup";
    const restaurantSnap = await getDoc(doc(db, "publicRestaurants", String(qr.restaurantId)));
    if (!restaurantSnap.exists() || restaurantSnap.data().status !== "ACTIVE") { if (live) setUnavailable(true); return; }
    const restaurant = restaurantSnap.data();
    stage = "loyalty profile lookup";
    const programSnap = await getDoc(doc(db, "loyaltyPublicPrograms", String(qr.restaurantId))); const p = programSnap.exists() ? programSnap.data() : {};
    if (live) setPage({ qrId: String(qr.qrId), ownerUid: String(qr.ownerUid), restaurantId: String(qr.restaurantId), restaurant: { id: String(qr.restaurantId), name: restaurant.name, businessType: restaurant.businessType, city: restaurant.city, logoUrl: restaurant.logoUrl, brandColor: restaurant.brandColor, googleReviewUrl: restaurant.googleReviewUrl, instagramUrl: restaurant.instagramUrl, facebookUrl: restaurant.facebookUrl, shareCaption: restaurant.shareCaption }, program: { id: String(p.programId || ""), isActive: Boolean(p.isActive), title: p.title || "Rewards Program", discountType: p.discountType || "FLAT", stampsRequired: Number(p.stampsRequired || 10), minBillAmount: Number(p.minBillAmount || 20000), rewardTitle: p.rewardTitle || "Reward", rewardDiscount: Number(p.rewardDiscount || 10000), rewardExpiryDays: Number(p.rewardExpiryDays || 30) } });
  } catch (e) {
    console.error(`Guest QR page could not load during ${stage}`, e);
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    const message = code === "auth/operation-not-allowed"
      ? "Guest sign-in is not enabled for this Firebase project. Enable Anonymous sign-in in Firebase Authentication."
      : code === "permission-denied"
        ? "Firebase denied access to this QR page. Check the deployed Firestore rules and public QR page."
        : code === "auth/unauthorized-domain"
          ? "This QR website is not authorized for Firebase sign-in. Add its domain to Firebase Authentication's authorized domains."
        : code === "unavailable" || code === "auth/network-request-failed"
          ? "Could not connect to Firebase. Check your connection and try again."
          : "This QR page is not available right now. Please try again.";
    if (live) setError(message);
  } finally { if (live) setLoading(false); } })(); return () => { live = false; }; }, [slug]);
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#FDFBF7] p-6 text-center text-sm text-[#716B64]">Loading restaurant…</main>;
  if (unavailable) return <main className="grid min-h-screen place-items-center bg-[#FDFBF7] p-6 text-center"><div className="max-w-sm"><p className="mb-4 text-4xl">🔒</p><h1 className="font-serif text-2xl font-bold text-stone-900">QR Code Unavailable</h1><p className="mx-auto mt-2 max-w-xs text-sm text-stone-600">This QR code is currently inactive. Please ask the restaurant staff for assistance.</p></div></main>;
  if (error || !page) return <main className="grid min-h-screen place-items-center bg-[#FDFBF7] p-6 text-center text-sm text-red-700">{error || "QR code not found."}</main>;
  const initialView = location.pathname.endsWith("/review") || search.get("view") === "review" ? "review" : location.pathname.endsWith("/loyalty") ? "card" : "welcome";
  return <CustomerJourneyView slug={slug} restaurant={page.restaurant} initialProgram={page.program} initialView={initialView} firebaseContext={{ qrId: page.qrId, ownerUid: page.ownerUid, restaurantId: page.restaurantId }} />;
}
