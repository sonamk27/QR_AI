import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reset_password"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
  }),
  z.object({
    action: z.literal("change_role"),
    role: z.enum(["restaurant_admin", "super_admin"]),
  }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return NextResponse.json({ error: errorMsg || "Invalid input." }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    include: { restaurants: { select: { id: true }, take: 1 } },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (parsed.data.action === "reset_password") {
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({
      where: { id: params.id },
      data: { passwordHash },
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "user.reset_password",
        target: targetUser.email,
        restaurantId: targetUser.restaurants[0]?.id,
        meta: { userId: targetUser.id },
      },
    });

    return NextResponse.json({ ok: true, message: "Password updated successfully." });
  }

  if (parsed.data.action === "change_role") {
    if (parsed.data.role === "super_admin" && targetUser.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super Admin accounts can only be provisioned through the seed script." },
        { status: 403 },
      );
    }

    // Prevent removing own super admin role
    if (targetUser.id === admin.id && parsed.data.role !== "super_admin") {
      return NextResponse.json(
        { error: "You cannot demote your own super admin account." },
        { status: 400 },
      );
    }

    await db.user.update({
      where: { id: params.id },
      data: { role: parsed.data.role },
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `user.role_change.${parsed.data.role}`,
        target: targetUser.email,
        restaurantId: targetUser.restaurants[0]?.id,
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
