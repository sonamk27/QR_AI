import QRCode from "qrcode";
import { randomBytes } from "crypto";

export const newSlug = () => randomBytes(16).toString("base64url");
export const qrUrl = (slug: string) => `${process.env.APP_URL ?? "http://localhost:3000"}/r/${slug}`;

/** QR images are generated on demand. The slug is the source of truth. */
export async function qrSvg(slug: string) {
  return QRCode.toString(qrUrl(slug), { type: "svg", margin: 2, errorCorrectionLevel: "M" });
}
export async function qrPng(slug: string) {
  return QRCode.toBuffer(qrUrl(slug), { type: "png", margin: 2, width: 1024, errorCorrectionLevel: "M" });
}
