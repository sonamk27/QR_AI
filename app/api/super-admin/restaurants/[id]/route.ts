import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";
import { isGoogleBusinessUrl } from "@/lib/google-business-url";

const schema = z.union([
  z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }),
  z.object({
    action: z.literal("update_owner"),
    ownerName: z.string().trim().min(2, "Owner name is required").max(80),
    ownerEmail: z.string().trim().email("Valid owner email is required").max(120),
  }),
  z.object({
    action: z.literal("update_google_link"),
    googleReviewUrl: z.string().trim().max(500).optional().or(z.literal("")).refine(
      (url) => !url || isGoogleBusinessUrl(url),
      "Enter a valid Google Maps or Google Business Profile URL using HTTPS.",
    ),
  }),
]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const restaurant = await db.restaurant.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });

  if ("action" in parsed.data && parsed.data.action === "update_owner") {
    const email = parsed.data.ownerEmail.toLowerCase();
    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser && existingUser.id !== restaurant.ownerId) {
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 });
    }

    await db.$transaction([
      db.user.update({
        where: { id: restaurant.ownerId },
        data: { name: parsed.data.ownerName, email },
      }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.owner_updated",
          target: params.id,
          restaurantId: params.id,
          meta: { ownerName: parsed.data.ownerName, ownerEmail: email },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if ("action" in parsed.data && parsed.data.action === "update_google_link") {
    const googleReviewUrl = parsed.data.googleReviewUrl || null;
    await db.$transaction([
      db.restaurant.update({
        where: { id: params.id },
        data: { googleReviewUrl },
      }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.google_link_updated",
          target: params.id,
          restaurantId: params.id,
          meta: { googleReviewUrl },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  await db.$transaction([
    db.restaurant.update({ where: { id: params.id }, data: { status: parsed.data.status } }),
    db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `restaurant.${parsed.data.status}`,
        target: params.id,
        restaurantId: params.id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
