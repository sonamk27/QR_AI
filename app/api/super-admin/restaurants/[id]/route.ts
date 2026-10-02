import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const restaurant = await db.restaurant.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
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
