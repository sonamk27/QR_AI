import { useOutletContext } from "react-router-dom";
import { doc, writeBatch } from "firebase/firestore";
import { ProfileForm } from "../../components/ProfileForm";
import { isGoogleBusinessUrl } from "../../lib/google-business-url";
import { getFirebaseServices } from "./firebase";
import type { DashboardOutletContext } from "./DashboardShell";

export default function ProfileSettingsPage() {
  const { restaurant, restaurantId, refreshRestaurant } = useOutletContext<DashboardOutletContext>();
  if (!restaurant || !restaurantId) return <p className="text-sm text-[#716B64]">Loading restaurant profile…</p>;

  const db = getFirebaseServices().db;
  const restaurantRef = doc(db, "restaurants", restaurantId);
  const publicRestaurantRef = doc(db, "publicRestaurants", restaurantId);
  const publicRestaurantData = {
    restaurantId, name: restaurant.name, businessType: restaurant.businessType ?? "RESTAURANT", city: restaurant.city ?? null,
    logoUrl: restaurant.logoUrl ?? null, brandColor: restaurant.brandColor ?? "#B58A4B",
    googleReviewUrl: restaurant.googleReviewUrl ?? null, instagramUrl: restaurant.instagramUrl ?? null,
    facebookUrl: restaurant.facebookUrl ?? null, shareCaption: restaurant.shareCaption ?? null,
  };
  const firebaseSavers = {
    onSaved: refreshRestaurant,
    saveIdentity: async (values: { name: string; city: string | null; logoUrl: string | null; brandColor: string }) => {
      if (values.name.length < 2 || values.name.length > 100) throw new Error("Restaurant name must be 2–100 characters.");
      if ((values.city?.length ?? 0) > 80) throw new Error("City must be 80 characters or fewer.");
      if (!/^#[0-9a-fA-F]{6}$/.test(values.brandColor)) throw new Error("Enter a valid 6-digit brand colour.");
      if (values.logoUrl) {
        try { new URL(values.logoUrl); } catch { throw new Error("Enter a valid logo URL."); }
      }
      const batch = writeBatch(db);
      batch.update(restaurantRef, values);
      batch.set(publicRestaurantRef, { ...publicRestaurantData, ...values, status: restaurant.status ?? "ACTIVE" }, { merge: true });
      await batch.commit();
    },
    saveGoogleUrl: async (url: string) => {
      if (!isGoogleBusinessUrl(url)) throw new Error("Enter a valid Google Maps or Google Business Profile URL using HTTPS.");
      const batch = writeBatch(db);
      batch.update(restaurantRef, { googleReviewUrl: url });
      batch.set(publicRestaurantRef, { ...publicRestaurantData, googleReviewUrl: url, status: restaurant.status ?? "ACTIVE" }, { merge: true });
      await batch.commit();
    },
    saveSocial: async (values: { instagramUrl: string | null; facebookUrl: string | null; shareCaption: string | null }) => {
      for (const [label, value] of [["Instagram", values.instagramUrl], ["Facebook", values.facebookUrl]] as const) {
        if (!value) continue;
        try { new URL(value); } catch { throw new Error(`Enter a valid ${label} URL.`); }
        if (value.length > 300) throw new Error(`${label} URL must be 300 characters or fewer.`);
      }
      if ((values.shareCaption?.length ?? 0) > 500) throw new Error("Caption must be 500 characters or fewer.");
      const batch = writeBatch(db);
      batch.update(restaurantRef, values);
      batch.set(publicRestaurantRef, { ...publicRestaurantData, ...values, status: restaurant.status ?? "ACTIVE" }, { merge: true });
      await batch.commit();
    },
  };

  return <div className="space-y-5">
    <h1 className="text-3xl font-semibold">Restaurant profile</h1>
    <ProfileForm r={{
      name: restaurant.name,
      city: restaurant.city ?? null,
      logoUrl: restaurant.logoUrl ?? null,
      googleReviewUrl: restaurant.googleReviewUrl ?? null,
      instagramUrl: restaurant.instagramUrl ?? null,
      facebookUrl: restaurant.facebookUrl ?? null,
      shareCaption: restaurant.shareCaption ?? null,
    }} firebaseSavers={firebaseSavers} />
  </div>;
}
