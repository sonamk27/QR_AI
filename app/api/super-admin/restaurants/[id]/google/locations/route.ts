import { NextResponse } from "next/server";
import { getSuperAdmin } from "@/lib/auth";
import { listGoogleBusinessLocations } from "@/lib/google-business-profile";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const connection = await db.googleBusinessConnection.findUnique({
    where: { restaurantId: params.id },
    select: { id: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "Connect a Google account first." }, { status: 404 });
  }

  try {
    const locations = await listGoogleBusinessLocations(connection.id);
    return NextResponse.json({ locations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Google Business Profile locations.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
