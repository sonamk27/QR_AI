import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { issueEmailVerification } from "@/lib/email-verification";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().trim().email().max(120) });

export async function POST(req: Request) {
  if (!rateLimit(`resend-verification:${clientIp(req)}`, 5, 3_600_000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const key = createHash("sha256").update(email).digest("hex").slice(0, 24);
  if (!rateLimit(`resend-verification-email:${key}`, 3, 3_600_000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerifiedAt: true } });
  if (!user || user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, message: "If the account needs verification, a new link has been sent." });
  }

  try {
    await issueEmailVerification(user.id, user.email);
  } catch (error) {
    console.error("Verification email could not be resent:", error);
    return NextResponse.json({ error: "Email verification is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, message: "If the account needs verification, a new link has been sent." });
}
