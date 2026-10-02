import { NextResponse } from "next/server";
import { getSuperAdmin } from "@/lib/auth";

export async function POST() {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(
    { error: "Runtime database setup is disabled. Apply the checked-in Prisma migration." },
    { status: 410 },
  );
}
