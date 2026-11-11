/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_FIREBASE_API_KEY: string;
  readonly NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly NEXT_PUBLIC_FIREBASE_APP_ID: string;
  readonly NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
  readonly NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY?: string;
  readonly VITE_QR_PRICE_PAISE?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_UPI_VPA?: string;
  readonly VITE_UPI_PAYEE_NAME?: string;
  readonly VITE_FIREBASE_EMULATORS?: string;
}
