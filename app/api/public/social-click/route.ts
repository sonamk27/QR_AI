import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  restaurantId: z.string().min(1),
  platform: z.enum(["instagram", "facebook"]),
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { restaurantId, platform, sessionId } = parsed.data;

  // Fire-and-forget — don't block the response on DB write
  const client = db as unknown as {
    socialClick?: {
      create: (args: {
        data: { restaurantId: string; platform: string; sessionId: string | null };
      }) => Promise<unknown>;
    };
  };

  if (client.socialClick?.create) {
    client.socialClick
      .create({ data: { restaurantId, platform, sessionId: sessionId ?? null } })
      .catch((err) => console.error("Failed to create social click:", err));
  } else {
    const id = `sc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    db.$executeRaw`
      INSERT INTO "social_clicks" ("id", "restaurant_id", "platform", "sessionId", "createdAt")
      VALUES (${id}, ${restaurantId}, ${platform}, ${sessionId ?? null}, CURRENT_TIMESTAMP)
    `.catch((err) => console.error("Failed to insert social click:", err));
  }

  return NextResponse.json({ ok: true });
}
