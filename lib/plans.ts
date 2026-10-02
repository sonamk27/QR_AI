/** Validity period for each QR code activation / renewal. */
export const QR_VALID_DAYS = 365;
export const GRACE_DAYS = 7;
/** Default standard price per QR per year in paise (e.g. ₹999 = 99900 paise). */
export const DEFAULT_QR_PRICE_PAISE = 99900;
/** Legacy alias for backwards compatibility if needed */
export const QR_PRICE_PAISE = DEFAULT_QR_PRICE_PAISE;
/** Fair-use cap on guest feedback processing per QR per month. */
export const MAX_FEEDBACK_PER_QR_PER_MONTH = 3000;
/** Legacy alias retained for the previous review-draft endpoint. */
export const MAX_DRAFTS_PER_QR_PER_MONTH = MAX_FEEDBACK_PER_QR_PER_MONTH;
/** Display helper: paise → ₹ string */
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
