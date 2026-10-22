"use client";

import { AnonLoyaltyCardView } from "./AnonLoyaltyCardView";

/**
 * LoyaltyCardView now delegates to the anonymous cookie-based card view.
 * Diners no longer enter phone numbers; identity is resolved via secure cookie.
 */
export function LoyaltyCardView({ slug }: { slug: string }) {
  return <AnonLoyaltyCardView slug={slug} />;
}
