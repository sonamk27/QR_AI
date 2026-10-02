import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2, "Restaurant name is required").max(100),
  city: z.string().max(80).optional(),
  googleReviewUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ownerName: z.string().min(2, "Owner name is required").max(80),
  ownerEmail: z.string().email("Valid owner email is required").max(120),
  password: z.string().min(6).max(100).optional(),
  referredByName: z.string().max(100).optional(),
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
  const rawPassword = data.password && data.password.trim().length >= 6
    ? data.password.trim()
    : `Rf${randomBytes(4).toString("hex")}`;

  let owner = await db.user.findUnique({ where: { email } });

  if (owner) {
    if (owner.role === "super_admin") {
      return NextResponse.json({ error: "Cannot assign restaurant to a super admin account." }, { status: 400 });
    }
  } else {
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    owner = await db.user.create({
      data: {
        email,
        name: data.ownerName.trim(),
        passwordHash,
        role: "restaurant_admin",
      },
    });
  }

  const restaurant = await db.restaurant.create({
    data: {
      ownerId: owner.id,
      name: data.name.trim(),
      city: data.city?.trim() || null,
      googleReviewUrl: data.googleReviewUrl?.trim() || null,
      referredByName: data.referredByName?.trim() || null,
      status: "ACTIVE",
    },
  });

  await db.auditLog.create({
    data: {
      actorId: admin.id,
      action: "restaurant.create",
      target: restaurant.id,
      restaurantId: restaurant.id,
    },
  });

  return NextResponse.json({
    ok: true,
    restaurant,
    owner: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
    },
    credentials: {
      email: owner.email,
      password: rawPassword,
    },
  });
}
