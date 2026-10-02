import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateDraft } from "@/lib/ai";
import { isActive } from "@/lib/qr-status";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { MAX_DRAFTS_PER_QR_PER_MONTH } from "@/lib/plans";

const schema = z.object({
  slug: z.string().min(1).max(40),
  sessionId: z.string().optional(),
  overall: z.number().int().min(1).max(5),
  food: z.number().int().min(1).max(5).optional(),
  service: z.number().int().min(1).max(5).optional(),
  chips: z.array(z.string().max(30)).max(8),
  text: z.string().max(600).optional(),
  variant: z.enum(["short", "casual", "detailed"]).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`gen:${clientIp(req)}`, 12, 600_000)) {
    return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;

  const qr = await db.qrCode.findUnique({ where: { slug: d.slug }, include: { restaurant: true } });
  if (!qr || !isActive(qr) || qr.restaurant.status !== "ACTIVE") {
    return NextResponse.json({ error: "Feedback is temporarily unavailable." }, { status: 403 });
  }
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const used = await db.feedbackSession.count({ where: { qrId: qr.id, completedAt: { gte: monthStart } } });
  if (used >= MAX_DRAFTS_PER_QR_PER_MONTH) {
    return NextResponse.json({ error: "Feedback is temporarily unavailable." }, { status: 403 });
  }

  // Regenerate reuses the same session; otherwise record a new one.
  let sessionId = d.sessionId;
  if (sessionId) {
    const exists = await db.feedbackSession.findFirst({ where: { id: sessionId, qrId: qr.id } });
    if (!exists) sessionId = undefined;
  }
  if (!sessionId) {
    const s = await db.feedbackSession.create({
      data: {
        qrId: qr.id,
        overallRating: d.overall,
        foodRating: d.food,
        serviceRating: d.service,
        chips: d.chips,
        freeText: d.text || null,
      },
    });
    sessionId = s.id;
  }

  const text = await generateDraft({
    restaurantName: qr.restaurant.name,
    overall: d.overall,
    food: d.food,
    service: d.service,
    chips: d.chips,
    text: d.text,
    variant: d.variant,
  });
  const draft = await db.draft.upsert({
    where: { sessionId },
    create: { sessionId, text },
    update: { text, editedText: null, regenerations: { increment: 1 } },
  });
  // The Google link is the same for every rating. We never hide it from low-rating customers.
  return NextResponse.json({ sessionId, draftId: draft.id, text, googleUrl: qr.restaurant.googleReviewUrl });
}
