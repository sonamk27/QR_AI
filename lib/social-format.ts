/**
 * Helper to extract clean display handles from social URLs
 */
export function extractSocialHandle(url: string | null | undefined, platform: "instagram" | "facebook"): string | null {
  if (!url) return null;
  try {
    const trimmed = url.trim().replace(/\/+$/, "");
    const parts = trimmed.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return null;
    // Strip query parameters
    const cleanHandle = last.split("?")[0].replace(/^@/, "");
    if (!cleanHandle) return null;

    if (platform === "instagram") {
      return `@${cleanHandle}`;
    }
    return `fb.com/${cleanHandle}`;
  } catch {
    return url;
  }
}
