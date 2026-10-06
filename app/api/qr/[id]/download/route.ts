import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerContext, getSuperAdmin } from "@/lib/auth";
import { qrPng, qrSvg } from "@/lib/qr";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const [ctx, admin] = await Promise.all([getOwnerContext(), getSuperAdmin()]);
  if (!ctx && !admin) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Super admin can download any QR; Owner can only download their restaurant's QR
  const qr = admin
    ? await db.qrCode.findUnique({ where: { id: params.id } })
    : await db.qrCode.findFirst({
        where: { id: params.id, restaurantId: ctx!.restaurant.id },
      });

  if (!qr) return NextResponse.json({ error: "QR code not found." }, { status: 404 });

  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const safeName = qr.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "qrcode";

  if (format === "svg") {
    return new NextResponse(await qrSvg(qr.slug), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}.svg"`,
      },
    });
  }

  return new NextResponse(new Uint8Array(await qrPng(qr.slug)), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}.png"`,
    },
  });
}
