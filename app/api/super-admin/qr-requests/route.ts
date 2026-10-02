import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requests = await db.qrRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: { include: { owner: { select: { name: true, email: true } } } },
      qrCodes: { select: { id: true, status: true, slug: true } },
      payments: { select: { id: true, status: true, amount: true } },
    },
  });

  return NextResponse.json({ requests });
}
