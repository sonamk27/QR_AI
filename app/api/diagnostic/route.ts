import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const types = await db.$queryRaw<Array<{ typname: string }>>`
    SELECT typname FROM pg_type WHERE typname = 'PaymentMethod'
  `;

  return NextResponse.json({ ok: true, types }, { headers: { "Cache-Control": "no-store" } });
}
