import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GRACE_DAYS } from "@/lib/plans";
import { sendEmail } from "@/lib/email";

const DAY = 86_400_000;

/** Daily job: ACTIVE -> GRACE -> EXPIRED, plus renewal reminders at 30, 7 and 1 days. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const toGrace = await db.qrCode.updateMany({
    where: { status: "ACTIVE", validUntil: { lt: now } },
    data: { status: "GRACE" },
  });
  const toExpired = await db.qrCode.updateMany({
    where: { status: "GRACE", validUntil: { lt: new Date(now.getTime() - GRACE_DAYS * DAY) } },
    data: { status: "EXPIRED" },
  });
  let reminders = 0;
  for (const d of [30, 7, 1]) {
    const from = new Date(now.getTime() + d * DAY);
    const to = new Date(from.getTime() + DAY);
    const qrs = await db.qrCode.findMany({
      where: { status: "ACTIVE", validUntil: { gte: from, lt: to } },
      include: { restaurant: { include: { owner: true } } },
    });
    for (const q of qrs) {
      await sendEmail(
        q.restaurant.owner.email,
        `Your QR "${q.name}" expires in ${d} day${d > 1 ? "s" : ""}`,
        `<p>Hi ${q.restaurant.owner.name},</p><p>Your QR code "${q.name}" for ${q.restaurant.name} expires in ${d} day(s). Contact your representative or administrator to renew your subscription so customers can keep leaving reviews. The printed QR stays the same.</p>`,
      );
      reminders++;
    }
  }
  return NextResponse.json({ toGrace: toGrace.count, toExpired: toExpired.count, reminders });
}
