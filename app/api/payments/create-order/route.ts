import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Online payments are disabled. Payments are handled directly via UPI/Bank transfer." },
    { status: 410 }
  );
}
