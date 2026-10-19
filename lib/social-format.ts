/**
 * Helper to extract clean display handles and deep-linking URLs from social URLs
 */
export function extractRawHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const trimmed = url.trim().replace(/\/+$/, "");
    const parts = trimmed.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return null;
    const clean = last.split("?")[0].replace(/^@/, "");
    return clean || null;
  } catch {
    return null;
  }
}

export function extractSocialHandle(url: string | null | undefined, platform: "instagram" | "facebook"): string | null {
  if (!url) return null;
  const raw = extractRawHandle(url);
  if (!raw) return url;
  if (platform === "instagram") {
    return `@${raw}`;
  }
  return `fb.com/${raw}`;
}

/**
 * Returns deep-link app URL (for native Instagram / Facebook apps on mobile) and fallback web URL
 */
export function getSocialFollowUrls(url: string | null | undefined, platform: "instagram" | "facebook"): {
  appUrl: string;
  webUrl: string;
  handle: string | null;
} | null {
  if (!url) return null;
  const raw = extractRawHandle(url);
  const webUrl = url.trim();

  if (platform === "instagram") {
    return {
      appUrl: raw ? `instagram://user?username=${raw}` : webUrl,
      webUrl,
      handle: raw ? `@${raw}` : null,
    };
  }

  if (platform === "facebook") {
    return {
      appUrl: raw ? `fb://facename/${raw}` : webUrl,
      webUrl,
      handle: raw ? `fb.com/${raw}` : null,
    };
  }

  return { appUrl: webUrl, webUrl, handle: raw };
}

/**
 * Formats a review draft with the restaurant's social handle and caption/hashtags
 */
export function formatReviewWithTag(
  draft: string,
  restaurantName: string,
  handle?: string | null,
  shareCaption?: string | null
): string {
  const parts = [draft.trim()];
  if (shareCaption?.trim()) {
    parts.push(shareCaption.trim());
  } else if (handle?.trim()) {
    parts.push(`— visiting ${restaurantName} (${handle.trim()})`);
  }
  return parts.join("\n\n");
}
