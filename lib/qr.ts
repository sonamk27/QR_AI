import QRCode from "qrcode";
import { randomBytes } from "crypto";

export const newSlug = () => randomBytes(16).toString("base64url");

export function appBaseUrl() {
  const configuredUrl =
    process.env.APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();
  const value =
    configuredUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");

  if (!value) {
    throw new Error("Set APP_URL to your deployed application URL before generating QR codes.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    (process.env.NODE_ENV === "production" &&
      (url.protocol !== "https:" ||
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1"))
  ) {
    throw new Error("APP_URL must be the public HTTPS URL of the deployed application.");
  }

  return url.origin;
}

export const qrUrl = (slug: string) => new URL(`/r/${slug}`, appBaseUrl()).toString();

/** QR images are generated on demand. The slug is the source of truth. */
export async function qrSvg(slug: string) {
  return QRCode.toString(qrUrl(slug), { type: "svg", margin: 2, errorCorrectionLevel: "M" });
}
export async function qrPng(slug: string) {
  return QRCode.toBuffer(qrUrl(slug), { type: "png", margin: 2, width: 1024, errorCorrectionLevel: "M" });
}
