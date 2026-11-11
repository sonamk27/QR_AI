export const CONSENT_STORAGE_KEY = "reviewflow-analytics-consent";
export const COOKIE_PREFERENCES_EVENT = "reviewflow:cookie-preferences";

export function hasAnalyticsConsent(): boolean {
  return window.localStorage.getItem(CONSENT_STORAGE_KEY) === "granted";
}

export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT));
}

export async function applyAnalyticsConsent(allowed: boolean): Promise<boolean> {
  const { setAnalyticsConsent } = await import("./analytics");
  return setAnalyticsConsent(allowed);
}

export async function trackConsentedPageView(pathname: string): Promise<void> {
  if (!hasAnalyticsConsent()) return;
  const { trackPageView } = await import("./analytics");
  await trackPageView(pathname);
}
