import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Password sign-in is handled by Firebase Authentication. Update the app and sign in again." }, { status: 410 });
}
