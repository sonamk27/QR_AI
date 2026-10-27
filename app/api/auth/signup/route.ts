import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { issueEmailVerification } from "@/lib/email-verification";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(100),
  restaurantName: z.string().trim().min(2).max(100),
  city: z.string().trim().max(80).optional(),
  refCode: z.string().trim().max(40).optional(),
}).strict();

export async function POST(req: Request) {
  try {
    if (!rateLimit(`signup:${clientIp(req)}`, 10, 3_600_000)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Check your details and try again." }, { status: 400 });
    const d = parsed.data;
    const email = d.email.toLowerCase();
    if (await db.user.findUnique({ where: { email } })) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    const user = await db.user.create({
      data: {
        email,
        name: d.name,
        emailVerifiedAt: null,
        passwordHash: await bcrypt.hash(d.password, 12),
        role: "restaurant_admin",
        restaurants: {
          create: {
            name: d.restaurantName,
            city: d.city,
            referredByName: d.refCode?.trim() || null,
          },
        },
      },
    });
    try {
      await issueEmailVerification(user.id, user.email);
    } catch (mailError) {
      console.error("Signup verification email could not be sent:", mailError);
    }
    return NextResponse.json({ ok: true, emailVerificationRequired: true, redirect: `/verify-email?email=${encodeURIComponent(user.email)}` }, { status: 201 });
  } catch (error: any) {
    console.error("Signup error:", error);
    const isDbError =
      error?.message?.includes?.("DATABASE_URL") ||
      error?.name === "PrismaClientInitializationError" ||
      error?.name === "PrismaClientKnownRequestError" ||
      error?.code?.startsWith?.("P");
    return NextResponse.json(
      {
        error: isDbError
          ? "Database connection failed. Please verify your DATABASE_URL in .env and run 'npx prisma db push'."
          : "Server error during signup. Check terminal console for details.",
      },
      { status: 500 }
    );
  }
}
