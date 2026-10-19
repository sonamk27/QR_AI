import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/auth";

const schema = z.object({
  instagramUrl: z
    .string()
    .trim()
    .max(300)
    .url("Enter a valid Instagram URL.")
    .optional()
    .or(z.literal("")),
  facebookUrl: z
    .string()
    .trim()
    .max(300)
    .url("Enter a valid Facebook URL.")
    .optional()
    .or(z.literal("")),
  shareCaption: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const ctx = await getOwnerContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    return NextResponse.json({ error: msg || "Invalid input." }, { status: 400 });
  }

  const d = parsed.data;
  try {
    await db.restaurant.update({
      where: { id: ctx.restaurant.id },
      data: {
        instagramUrl: d.instagramUrl || null,
        facebookUrl: d.facebookUrl || null,
        shareCaption: d.shareCaption || null,
      },
    });
  } catch {
    await db.$executeRaw`
      UPDATE "Restaurant"
      SET "instagramUrl" = ${d.instagramUrl || null},
          "facebookUrl" = ${d.facebookUrl || null},
          "shareCaption" = ${d.shareCaption || null}
      WHERE "id" = ${ctx.restaurant.id}
    `;
  }

  return NextResponse.json({ ok: true });
}
