import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verificationTokenHash } from "@/lib/email-verification";

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This verification link is invalid." }, { status: 400 });
  const tokenHash = verificationTokenHash(parsed.data.token);
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt <= new Date()) {
    if (record) await db.emailVerificationToken.delete({ where: { id: record.id } });
    return NextResponse.json({ error: "This verification link has expired or was already used. Request a new link." }, { status: 400 });
  }

  const changed = await db.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationToken.deleteMany({
      where: { id: record.id, tokenHash, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    return true;
  });
  if (!changed) return NextResponse.json({ error: "This verification link has expired or was already used." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
