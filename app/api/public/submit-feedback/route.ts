import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isActive } from "@/lib/qr-status";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { MAX_FEEDBACK_PER_QR_PER_MONTH } from "@/lib/plans";

const schema = z.object({
  slug: z.string().min(1).max(40),
  overall: z.number().int().min(1).max(5),
  food: z.number().int().min(1).max(5).optional(),
  service: z.number().int().min(1).max(5).optional(),
  chips: z.array(z.string().trim().min(1).max(70)).max(8),
  text: z.string().trim().max(600).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`submit-feedback:${clientIp(req)}`, 12, 600_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const feedback = parsed.data;

  const qr = await db.qrCode.findUnique({
    where: { slug: feedback.slug },
    include: { restaurant: { select: { status: true, googleReviewUrl: true } } },
  });
  if (!qr || !isActive(qr) || qr.restaurant.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Feedback is temporarily unavailable." },
      { status: 403 },
    );
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const used = await db.feedbackSession.count({
    where: { qrId: qr.id, completedAt: { gte: monthStart } },
  });
  if (used >= MAX_FEEDBACK_PER_QR_PER_MONTH) {
    return NextResponse.json(
      { error: "Feedback is temporarily unavailable." },
      { status: 403 },
    );
  }

  const session = await db.feedbackSession.create({
    data: {
      qrId: qr.id,
      overallRating: feedback.overall,
      foodRating: feedback.food,
      serviceRating: feedback.service,
      chips: feedback.chips,
      freeText: feedback.text || null,
    },
  });
  return NextResponse.json({
    sessionId: session.id,
    googleUrl: qr.restaurant.googleReviewUrl,
  });
}
