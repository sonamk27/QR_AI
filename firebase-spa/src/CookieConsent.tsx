import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  applyAnalyticsConsent,
  COOKIE_PREFERENCES_EVENT,
  CONSENT_STORAGE_KEY,
  trackConsentedPageView,
} from "./consent";

const analyticsConfigured = Boolean(import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim());

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    setVisible(savedConsent !== "granted" && savedConsent !== "denied");
    const openPreferences = () => {
      setMessage("");
      setVisible(true);
    };
    window.addEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, openPreferences);
  }, []);

  async function chooseAnalytics(allowed: boolean) {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, allowed ? "granted" : "denied");
      const available = await applyAnalyticsConsent(allowed);
      if (allowed && available) {
        await trackConsentedPageView(window.location.pathname);
      }
      setMessage("");
      setVisible(false);
    } catch (error) {
      console.error("Could not update analytics consent", error);
      setMessage("Could not save or update your analytics preference. Please try again.");
      setVisible(true);
    }
  }

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-[#D8CBB6] bg-white p-4 shadow-elevated sm:inset-x-5 sm:bottom-5 sm:flex sm:items-center sm:gap-6 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <h2 id="cookie-consent-title" className="font-serif text-base font-bold text-[#24211E]">
          Your privacy choices
        </h2>
        <p id="cookie-consent-description" className="mt-1 text-xs leading-relaxed text-[#4A453F]">
          Essential storage keeps sign-in and core features working. Optional Firebase Analytics is used only if you allow it.
          Read our <Link to="/privacy" className="font-semibold underline">Privacy Policy</Link>.
        </p>
        {!analyticsConfigured && (
          <p className="mt-1 text-xs text-[#4A453F]">Optional analytics are not configured on this deployment.</p>
        )}
        {message && <p role="status" className="mt-2 text-xs font-medium text-[#573E1B]">{message}</p>}
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
        <button
          type="button"
          onClick={() => void chooseAnalytics(false)}
          className="min-h-11 rounded-xl border border-[#D8CBB6] bg-white px-3 py-2 text-xs font-semibold text-[#24211E] hover:bg-[#FAF7F2]"
        >
          Reject optional
        </button>
        <button
          type="button"
          onClick={() => void chooseAnalytics(true)}
          className="min-h-11 rounded-xl bg-[#8B642D] px-3 py-2 text-xs font-bold text-white hover:bg-[#704A20]"
        >
          Accept analytics
        </button>
      </div>
    </aside>
  );
}
