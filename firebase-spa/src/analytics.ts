import {
  getAnalytics,
  isSupported,
  logEvent,
  setAnalyticsCollectionEnabled,
  setConsent,
  type Analytics,
} from "firebase/analytics";
import { getFirebaseServices } from "./firebase";

let analytics: Analytics | null = null;

export async function setAnalyticsConsent(allowed: boolean): Promise<boolean> {
  if (!allowed) {
    if (analytics) {
      setConsent({
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      setAnalyticsCollectionEnabled(analytics, false);
    }
    return true;
  }

  if (!import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim()) return false;
  if (!(await isSupported())) return false;

  const { app } = getFirebaseServices();
  analytics ??= getAnalytics(app);
  setConsent({
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  setAnalyticsCollectionEnabled(analytics, true);
  return true;
}

export async function trackPageView(pathname: string): Promise<void> {
  if (!analytics && !(await setAnalyticsConsent(true))) return;
  if (!analytics) return;

  logEvent(analytics, "page_view", {
    page_path: pathname,
    page_title: document.title,
    page_location: window.location.href,
  });
}
