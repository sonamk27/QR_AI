import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdmin } from "@/lib/auth";
import { listGoogleBusinessLocations } from "@/lib/google-business-profile";
import { db } from "@/lib/db";

const schema = z.object({
  locationName: z.string().regex(/^accounts\/[^/]+\/locations\/[^/]+$/),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid Google Business Profile location." }, { status: 400 });
  }

  const connection = await db.googleBusinessConnection.findUnique({
    where: { restaurantId: params.id },
    select: { id: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "Connect a Google account first." }, { status: 404 });
  }

  try {
    const locations = await listGoogleBusinessLocations(connection.id);
    const selectedLocation = locations.find((location) => location.name === parsed.data.locationName);
    if (!selectedLocation) {
      return NextResponse.json(
        { error: "That location is not available to the connected Google account." },
        { status: 400 },
      );
    }

    await db.$transaction([
      db.googleBusinessConnection.update({
        where: { id: connection.id },
        data: {
          locationName: selectedLocation.name,
          locationTitle: selectedLocation.title,
        },
      }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "restaurant.google_location_associated",
          target: params.id,
          restaurantId: params.id,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not associate the Google location.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
