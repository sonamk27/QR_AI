import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  portal: z.enum(["restaurant_admin", "super_admin"]).optional(),
});

export async function POST(req: Request) {
  try {
    if (!rateLimit(`login:${clientIp(req)}`, 15, 900_000)) {
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    if (parsed.data.portal && user.role !== parsed.data.portal) {
      const expectedPortal =
        user.role === "super_admin" ? "/super-admin/login" : "/admin/login";
      return NextResponse.json(
        {
          error:
            user.role === "super_admin"
              ? "This account is for the Super Admin portal."
              : "This account is for the Restaurant Admin portal.",
          redirect: expectedPortal,
        },
        { status: 403 },
      );
    }
    setSessionCookie(await createSessionToken({ uid: user.id, role: user.role }));
    const redirect = user.role === "super_admin" ? "/superadmin" : "/dashboard";
    return NextResponse.json({ ok: true, redirect });
  } catch (error: any) {
    console.error("Login error:", error);
    const isDbError =
      error?.message?.includes?.("DATABASE_URL") ||
      error?.name === "PrismaClientInitializationError" ||
      error?.name === "PrismaClientKnownRequestError" ||
      error?.code?.startsWith?.("P");
    return NextResponse.json(
      {
        error: isDbError
          ? "Database connection failed. Please verify your DATABASE_URL in .env."
          : "Server error during login. Check terminal console for details.",
      },
      { status: 500 }
    );
  }
}
