import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const qr = await db.qrCode.findUnique({ where: { slug: params.slug }, include: { restaurant: true } });
  if (!qr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    name: qr.restaurant.name,
    logoUrl: qr.restaurant.logoUrl,
    brandColor: qr.restaurant.brandColor,
    available: isActive(qr) && qr.restaurant.status === "ACTIVE",
  });
}
