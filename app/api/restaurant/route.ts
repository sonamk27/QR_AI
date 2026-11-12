import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";
import { isSupportedLogo, MAX_LOGO_DATA_URL_LENGTH } from "@/lib/logo-url";

const schema = z.object({
  name: z.string().min(2).max(100),
  city: z.string().max(80).optional().nullable(),
  logoUrl: z.string().trim().max(MAX_LOGO_DATA_URL_LENGTH).optional().nullable().or(z.literal(""))
    .refine((logo) => !logo || isSupportedLogo(logo), "Use a secure logo image URL or upload a supported image."),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function PATCH(req: Request) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  const d = parsed.data;
  await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data: { name: d.name, city: d.city || null, logoUrl: d.logoUrl || null, brandColor: d.brandColor },
  });
  return NextResponse.json({ ok: true });
}
