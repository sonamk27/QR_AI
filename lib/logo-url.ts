export const MAX_LOGO_DATA_URL_LENGTH = 150_000;
export const MAX_LOGO_URL_LENGTH = 2_000;

export function isSupportedLogoUrl(value: string): boolean {
  if (value.length > MAX_LOGO_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSupportedLogoDataUrl(value: string): boolean {
  return value.length <= MAX_LOGO_DATA_URL_LENGTH
    && /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function isSupportedLogo(value: string): boolean {
  return isSupportedLogoUrl(value) || isSupportedLogoDataUrl(value);
}
