export function isSupportedLogoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return /\.(png|svg)$/i.test(url.pathname);
  } catch {
    return false;
  }
}
