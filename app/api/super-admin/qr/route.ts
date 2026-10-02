import { NextResponse } from "next/server";
import { getSuperAdmin } from "@/lib/auth";

export async function POST() {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(
    { error: "QR codes are created only after payment is verified for an approved request." },
    { status: 410 },
  );
}
