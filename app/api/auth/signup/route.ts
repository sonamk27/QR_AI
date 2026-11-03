import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Account creation is handled by Firebase Authentication. Update the app and try again." }, { status: 410 });
}
