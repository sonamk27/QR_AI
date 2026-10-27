import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";
import { isGoogleBusinessUrl } from "@/lib/google-business-url";
import { issueEmailVerification } from "@/lib/email-verification";

const schema = z.union([
  z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }),
  z.object({
    action: z.literal("update_restaurant"),
    name: z.string().trim().min(2).max(100),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    logoUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    googleReviewUrl: z.string().trim().max(500).optional().or(z.literal("")).refine(
      (url) => !url || isGoogleBusinessUrl(url),
      "Enter a valid Google Maps or Google Business Profile URL using HTTPS.",
    ),
    instagramUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
    facebookUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
    shareCaption: z.string().trim().max(500).optional().or(z.literal("")),
    referredByName: z.string().trim().max(100).optional().or(z.literal("")),
    ownerName: z.string().trim().min(2).max(80),
    ownerEmail: z.string().trim().email().max(120),
  }),
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
  z.object({
    action: z.literal("update_social_links"),
    instagramUrl: z.string().trim().url("Enter a valid Instagram URL.").max(300).optional().or(z.literal("")),
    facebookUrl: z.string().trim().url("Enter a valid Facebook URL.").max(300).optional().or(z.literal("")),
    shareCaption: z.string().trim().max(500).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("update_ai"),
    aiEnabled: z.boolean(),
  }),
]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const restaurant = await db.restaurant.findUnique({
    where: { id: id },
    include: { owner: { select: { id: true, name: true, email: true, emailVerifiedAt: true } } },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  return NextResponse.json({ restaurant });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const restaurant = await db.restaurant.findUnique({
    where: { id: id },
    select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });

  if ("action" in parsed.data && parsed.data.action === "update_restaurant") {
    const d = parsed.data;
    const email = d.ownerEmail.toLowerCase();
    const [existingUser, owner] = await Promise.all([
      db.user.findUnique({ where: { email }, select: { id: true } }),
      db.user.findUnique({ where: { id: restaurant.ownerId }, select: { email: true } }),
    ]);
    if (existingUser && existingUser.id !== restaurant.ownerId) {
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 });
    }
    const emailChanged = owner?.email.toLowerCase() !== email;

    await db.$transaction([
      db.restaurant.update({
        where: { id: id },
        data: {
          name: d.name,
          city: d.city || null,
          logoUrl: d.logoUrl || null,
          brandColor: d.brandColor,
          googleReviewUrl: d.googleReviewUrl || null,
          instagramUrl: d.instagramUrl || null,
          facebookUrl: d.facebookUrl || null,
          shareCaption: d.shareCaption || null,
          referredByName: d.referredByName || null,
        },
      }),
      db.user.update({
        where: { id: restaurant.ownerId },
        data: { name: d.ownerName, email, emailVerifiedAt: emailChanged ? null : undefined },
      }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.profile_updated",
          target: id,
          restaurantId: id,
          meta: { restaurantName: d.name, ownerEmail: email },
        },
      }),
    ]);
    if (emailChanged) {
      try {
        await issueEmailVerification(restaurant.ownerId, email);
      } catch (error) {
        console.error("Updated owner verification email could not be sent:", error);
      }
    }
    return NextResponse.json({ ok: true, emailVerificationRequired: emailChanged });
  }

  if ("action" in parsed.data && parsed.data.action === "update_owner") {
    const email = parsed.data.ownerEmail.toLowerCase();
    const [existingUser, owner] = await Promise.all([
      db.user.findUnique({ where: { email }, select: { id: true } }),
      db.user.findUnique({ where: { id: restaurant.ownerId }, select: { email: true } }),
    ]);
    if (existingUser && existingUser.id !== restaurant.ownerId) {
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 });
    }
    const emailChanged = owner?.email.toLowerCase() !== email;

    await db.$transaction([
      db.user.update({
        where: { id: restaurant.ownerId },
        data: { name: parsed.data.ownerName, email, emailVerifiedAt: emailChanged ? null : undefined },
      }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.owner_updated",
          target: id,
          restaurantId: id,
          meta: { ownerName: parsed.data.ownerName, ownerEmail: email },
        },
      }),
    ]);
    if (emailChanged) {
      try {
        await issueEmailVerification(restaurant.ownerId, email);
      } catch (error) {
        console.error("Updated owner verification email could not be sent:", error);
      }
    }
    return NextResponse.json({ ok: true, emailVerificationRequired: emailChanged });
  }

  if ("action" in parsed.data && parsed.data.action === "update_google_link") {
    const googleReviewUrl = parsed.data.googleReviewUrl || null;
    await db.$transaction([
      db.restaurant.update({
        where: { id: id },
        data: { googleReviewUrl },
      }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.google_link_updated",
          target: id,
          restaurantId: id,
          meta: { googleReviewUrl },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if ("action" in parsed.data && parsed.data.action === "update_social_links") {
    const d = parsed.data;
    try {
      await db.restaurant.update({
        where: { id: id },
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
        WHERE "id" = ${id}
      `;
    }
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "restaurant.social_links_updated",
        target: id,
        restaurantId: id,
        meta: {
          instagramUrl: d.instagramUrl || null,
          facebookUrl: d.facebookUrl || null,
          shareCaption: d.shareCaption || null,
        },
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if ("action" in parsed.data && parsed.data.action === "update_ai") {
    const d = parsed.data;
    await db.restaurant.update({
      where: { id: id },
      data: { aiEnabled: d.aiEnabled },
    });
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "restaurant.ai_updated",
        target: id,
        restaurantId: id,
        meta: { aiEnabled: d.aiEnabled },
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  await db.$transaction([
    db.restaurant.update({ where: { id: id }, data: { status: parsed.data.status } }),
    db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `restaurant.${parsed.data.status}`,
        target: id,
        restaurantId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
