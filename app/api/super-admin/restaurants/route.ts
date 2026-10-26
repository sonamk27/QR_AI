import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";
import { isGoogleBusinessUrl } from "@/lib/google-business-url";

const schema = z.object({
  name: z.string().trim().min(2, "Restaurant name is required").max(100),
  city: z.string().max(80).optional(),
  googleReviewUrl: z.string().trim().max(500).optional().or(z.literal("")).refine(
    (url) => !url || isGoogleBusinessUrl(url),
    "Enter a valid Google Maps or Google Business Profile URL using HTTPS.",
  ),
  instagramUrl: z.string().trim().url("Enter a valid Instagram URL.").max(300).optional().or(z.literal("")),
  facebookUrl: z.string().trim().url("Enter a valid Facebook URL.").max(300).optional().or(z.literal("")),
  shareCaption: z.string().trim().max(500).optional().or(z.literal("")),
  ownerName: z.string().trim().min(2, "Owner name is required").max(80),
  ownerEmail: z.string().trim().email("Valid owner email is required").max(120),
  password: z.string().min(6).max(100).optional(),
  referredByName: z.string().max(100).optional(),
  aiEnabled: z.boolean().optional(),
});

export async function GET() {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const restaurants = await db.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { qrCodes: true } },
    },
  });

  return NextResponse.json({ restaurants });
}

export async function POST(req: Request) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return NextResponse.json({ error: errorMsg || "Invalid input." }, { status: 400 });
  }

  const data = parsed.data;
  const email = data.ownerEmail.trim().toLowerCase();
  const existingOwner = await db.user.findUnique({ where: { email }, select: { role: true } });
  if (existingOwner) {
    return NextResponse.json(
      { error: "This email already has an account. Use a new owner email so the restaurant is connected to the correct account." },
      { status: 409 },
    );
  }

  const rawPassword = data.password && data.password.trim().length >= 6
    ? data.password.trim()
    : `Rf${randomBytes(4).toString("hex")}`;
  const passwordHash = await bcrypt.hash(rawPassword, 12);
  let created: {
    owner: Awaited<ReturnType<typeof db.user.create>>;
    restaurant: Awaited<ReturnType<typeof db.restaurant.create>>;
  } | null = null;
  try {
    created = await db.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          email,
          name: data.ownerName,
          passwordHash,
          role: "restaurant_admin",
        },
      });
      const restaurant = await tx.restaurant.create({
        data: {
          ownerId: owner.id,
          name: data.name,
          city: data.city?.trim() || null,
          googleReviewUrl: data.googleReviewUrl?.trim() || null,
          instagramUrl: data.instagramUrl?.trim() || null,
          facebookUrl: data.facebookUrl?.trim() || null,
          shareCaption: data.shareCaption?.trim() || null,
          referredByName: data.referredByName?.trim() || null,
          status: "ACTIVE",
          aiEnabled: data.aiEnabled ?? true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.create",
          target: restaurant.id,
          restaurantId: restaurant.id,
        },
      });
      return { owner, restaurant };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists. Use a different owner email." },
        { status: 409 },
      );
    }
    console.error("[super-admin/restaurants] Failed to create owner and restaurant", error);
    return NextResponse.json({ error: "Unable to create the restaurant account. Please try again." }, { status: 500 });
  }

  if (!created) {
    return NextResponse.json({ error: "Unable to create the restaurant account. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    restaurant: created.restaurant,
    owner: {
      id: created.owner.id,
      name: created.owner.name,
      email: created.owner.email,
    },
    credentials: {
      email: created.owner.email,
      password: rawPassword,
    },
  });
}
