import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const log: string[] = [];
  try {
    await db.$executeRawUnsafe(`CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CASH', 'BANK', 'GATEWAY')`);
    log.push("PaymentMethod created");
  } catch (e: any) {
    log.push(`PaymentMethod creation error: ${e.message}`);
  }

  const types: any = await db.$queryRawUnsafe(`
    SELECT typname FROM pg_type WHERE typname = 'PaymentMethod'
  `);

  return NextResponse.json({ ok: true, log, types });
}
