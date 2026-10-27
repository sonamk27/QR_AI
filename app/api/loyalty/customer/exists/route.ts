import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateLoyaltyProgram, normalizePhone } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const phone = normalizePhone(searchParams.get("phone") || "");

  if (!slug || phone.length < 10) {
    return NextResponse.json({ error: "A restaurant and valid phone number are required" }, { status: 400 });
  }

  const qr = await db.qrCode.findUnique({
    where: { slug },
    select: { restaurantId: true, restaurant: { select: { status: true } } },
  });
  if (!qr || qr.restaurant.status !== "ACTIVE") {
    return NextResponse.json({ error: "Restaurant not found or inactive" }, { status: 404 });
  }

  const program = await getOrCreateLoyaltyProgram(qr.restaurantId);
  const customer = await db.loyaltyCustomer.findUnique({
    where: { programId_phone: { programId: program.id, phone } },
    select: { id: true },
  });

  return NextResponse.json({ exists: Boolean(customer) });
}
