import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({ sessionId: z.string(), editedText: z.string().max(2000).optional() });

/** Records that the customer tapped "Continue to Google". It does not mean a review was posted. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });
  const clickedAt = new Date();
  await Promise.all([
    db.feedbackSession.updateMany({
      where: { id: parsed.data.sessionId, googleClickedAt: null },
      data: { googleClickedAt: clickedAt },
    }),
    db.draft.updateMany({
      where: { sessionId: parsed.data.sessionId, googleClickedAt: null },
      data: { googleClickedAt: clickedAt, editedText: parsed.data.editedText },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
