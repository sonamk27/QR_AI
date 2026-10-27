import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function appOrigin() {
  const configured = process.env.APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("Email verification is not configured on this server.");
}

export async function issueEmailVerification(userId: string, email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email verification is not configured on this server.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.emailVerificationToken.upsert({
    where: { userId },
    update: { tokenHash: hashToken(token), expiresAt, createdAt: new Date() },
    create: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const verifyUrl = new URL("/verify-email", appOrigin());
  verifyUrl.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Verify your ReviewFlow email",
      html: `<p>Confirm that this email belongs to your ReviewFlow account.</p><p><a href="${verifyUrl.toString()}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Could not send verification email (${response.status}). ${detail}`);
  }
}

export function verificationTokenHash(token: string) {
  return hashToken(token);
}
