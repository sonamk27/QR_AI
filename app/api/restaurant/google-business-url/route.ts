import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { isGoogleBusinessUrl } from "@/lib/google-business-url";

const schema = z.object({
  googleBusinessUrl: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(isGoogleBusinessUrl),
});

export async function PATCH(req: Request) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid Google Maps or Google Business Profile URL using HTTPS." },
      { status: 400 },
    );
  }

  await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data: { googleReviewUrl: parsed.data.googleBusinessUrl },
  });
  return NextResponse.json({ ok: true });
}
