import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { downloadMedia } from "@/lib/whatsapp/adapter";

export const dynamic = "force-dynamic";

/** Shown in the page. Anything else a customer sends (html, svg, …) is only ever downloaded. */
const INLINE = /^(image\/(jpeg|png|webp)|video\/(mp4|3gpp)|audio\/[\w.+-]+)$/;

/** A customer's photo / video / voice note / document, proxied from Meta with our token. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("batch:manage");
  const { id } = await params;

  // Only media a customer actually sent us, so the token cannot be used to read anything else.
  const known = await prisma.message.findFirst({
    where: { direction: "INBOUND", payload: { path: ["mediaId"], equals: id } },
    select: { payload: true },
  });
  if (!known) return new NextResponse("Not found", { status: 404 });

  const file = await downloadMedia(id);
  if (!file?.body) return new NextResponse("Media is no longer available from WhatsApp.", { status: 404 });

  const type = file.headers.get("content-type")?.split(";")[0].trim() ?? "application/octet-stream";
  const filename = ((known.payload as { filename?: string }).filename ?? "file").replace(/["\\\r\n]/g, "");
  return new NextResponse(file.body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": INLINE.test(type) ? "inline" : `attachment; filename="${filename}"`,
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
