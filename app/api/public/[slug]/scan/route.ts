import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!rateLimit(`scan:${clientIp(req)}:${params.slug}`, 20, 600_000)) return NextResponse.json({ ok: true });
  const qr = await db.qrCode.findUnique({
    where: { slug: params.slug },
    include: { restaurant: { select: { status: true } } },
  });
  if (qr && isActive(qr) && qr.restaurant.status === "ACTIVE") {
    await db.scan.create({ data: { qrId: qr.id, userAgent: req.headers.get("user-agent")?.slice(0, 200) } });
  }
  return NextResponse.json({ ok: true });
}
