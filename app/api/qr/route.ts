import { NextResponse } from "next/server";

/**
 * QR creation is restricted to Super Admin after payment confirmation.
 */
export async function POST() {
  return NextResponse.json(
    { error: "QR codes are created and activated directly by the administrator upon payment." },
    { status: 403 }
  );
}
