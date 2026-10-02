import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).max(100),
  city: z.string().max(80).optional().nullable(),
  logoUrl: z.string().url().max(300).optional().nullable().or(z.literal("")),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  googleReviewUrl: z.string().url().max(500).optional().nullable().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  const d = parsed.data;
  await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data: { name: d.name, city: d.city || null, logoUrl: d.logoUrl || null, brandColor: d.brandColor, googleReviewUrl: d.googleReviewUrl || null },
  });
  return NextResponse.json({ ok: true });
}
