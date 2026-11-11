import { useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { CustomerJourneyView } from "../../components/customer/CustomerJourneyView";
import { getFirebaseServices } from "./firebase";
import { resolveQrStatus } from "./qrStatus";
import { getSiteOrigin, updatePageMetadata, updateStructuredData } from "./seo";

export default function PublicQrPage() {
  const { slug = "" } = useParams(); const [search] = useSearchParams(); const location = useLocation();
  const [page, setPage] = useState<any>(null); const [loading, setLoading] = useState(true); const [unavailable, setUnavailable] = useState(false); const [error, setError] = useState(""); const [guestAuthError, setGuestAuthError] = useState("");
  useEffect(() => {
    let live = true;
    let stage = "Firebase setup";
    setLoading(true);
    setPage(null);
    setUnavailable(false);
    setError("");
    setGuestAuthError("");
    void (async () => {
      try {
        const { auth, db } = getFirebaseServices();
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
        const programSnap = await getDoc(doc(db, "loyaltyPublicPrograms", String(qr.restaurantId)));
        const p = programSnap.exists() ? programSnap.data() : {};
        const pageData = {
          qrId: String(qr.qrId),
          ownerUid: String(qr.ownerUid),
          restaurantId: String(qr.restaurantId),
          restaurant: {
            id: String(qr.restaurantId),
            name: restaurant.name,
            businessType: restaurant.businessType,
            city: restaurant.city,
            logoUrl: restaurant.logoUrl,
            brandColor: restaurant.brandColor,
            googleReviewUrl: restaurant.googleReviewUrl,
            instagramUrl: restaurant.instagramUrl,
            facebookUrl: restaurant.facebookUrl,
            shareCaption: restaurant.shareCaption,
          },
          program: {
            id: String(p.programId || ""),
            isActive: Boolean(p.isActive),
            title: p.title || "Rewards Program",
            discountType: p.discountType || "FLAT",
            stampsRequired: Number(p.stampsRequired || 10),
            minBillAmount: Number(p.minBillAmount || 20000),
            rewardTitle: p.rewardTitle || "Reward",
            rewardDiscount: Number(p.rewardDiscount || 10000),
            rewardExpiryDays: Number(p.rewardExpiryDays || 30),
          },
        };
        try {
          stage = "guest sign-in";
          await auth.authStateReady();
          if (!auth.currentUser) await signInAnonymously(auth);
        } catch (authError) {
          console.error("Guest QR page loaded but guest sign-in failed", authError);
          const code = authError && typeof authError === "object" && "code" in authError ? String(authError.code) : "";
          const message = code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation"
            ? "The QR page loaded, but guest features need Anonymous sign-in enabled in Firebase Authentication."
            : code === "auth/unauthorized-domain"
              ? "The QR page loaded, but this domain must be added to Firebase Authentication's authorized domains for guest features."
              : code === "unavailable" || code === "auth/network-request-failed"
                ? "The QR page loaded, but guest features could not connect to Firebase. Check your connection and try again."
                : `The QR page loaded, but guest sign-in failed${code ? ` (${code})` : ""}. Some guest features may not work.`;
          if (live) setGuestAuthError(message);
        }
        if (live) setPage(pageData);
      } catch (e) {
        console.error(`Guest QR page could not load during ${stage}`, e);
        const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
        const message = code === "permission-denied"
          ? "Firebase denied access to this QR page. Check the deployed Firestore rules and public QR page."
          : code === "unavailable"
            ? "Could not connect to Firebase. Check your connection and try again."
            : `This QR page could not complete its ${stage}${code ? ` (${code})` : ""}. Please try again.`;
        if (live) setError(message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [slug]);
  useEffect(() => {
    if (!page) {
      updateStructuredData("reviewflow-local-business-schema");
      return;
    }

    const restaurant = page.restaurant;
    const origin = getSiteOrigin();
    const canonicalPath = location.pathname;
    const canonicalUrl = new URL(canonicalPath, `${origin}/`).href;
    const city = typeof restaurant.city === "string" ? restaurant.city.trim() : "";
    updatePageMetadata({
      title: `${restaurant.name} guest reviews and rewards | ReviewFlow`,
      description: city
        ? `Share feedback and explore ${restaurant.name}'s guest rewards in ${city}.`
        : `Share feedback and explore ${restaurant.name}'s guest rewards.`,
      noIndex: true,
    }, canonicalPath);

    if (city) {
      updateStructuredData("reviewflow-local-business-schema", {
        "@context": "https://schema.org",
        "@type": restaurant.businessType === "RESTAURANT" ? "Restaurant" : "LocalBusiness",
        "@id": canonicalUrl,
        name: restaurant.name,
        url: canonicalUrl,
        ...(restaurant.logoUrl ? { image: restaurant.logoUrl } : {}),
        address: {
          "@type": "PostalAddress",
          addressLocality: city,
        },
      });
    } else {
      updateStructuredData("reviewflow-local-business-schema");
    }
  }, [location.pathname, page]);
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#FDFBF7] p-6 text-center text-sm text-[#716B64]">Loading restaurant…</main>;
  if (unavailable) return <main className="grid min-h-screen place-items-center bg-[#FDFBF7] p-6 text-center"><div className="max-w-sm"><p className="mb-4 text-4xl">🔒</p><h1 className="font-serif text-2xl font-bold text-stone-900">QR Code Unavailable</h1><p className="mx-auto mt-2 max-w-xs text-sm text-stone-600">This QR code is currently inactive. Please ask the restaurant staff for assistance.</p></div></main>;
  if (error || !page) return <main className="grid min-h-screen place-items-center bg-[#FDFBF7] p-6 text-center text-sm text-red-700">{error || "QR code not found."}</main>;
  const initialView = location.pathname.endsWith("/review") || search.get("view") === "review" ? "review" : location.pathname.endsWith("/loyalty") ? "card" : "welcome";
  return <>
    {guestAuthError && <p role="alert" className="mx-auto mt-3 max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{guestAuthError}</p>}
    <CustomerJourneyView slug={slug} restaurant={page.restaurant} initialProgram={page.program} initialView={initialView} firebaseContext={{ qrId: page.qrId, ownerUid: page.ownerUid, restaurantId: page.restaurantId }} />
  </>;
}
