import "server-only";
import { uploadFile } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { downloadMedia } from "@/lib/whatsapp/adapter";

/** Meta keeps a customer's media about 30 days; older ids are gone. */
const META_KEEPS_MS = 30 * 24 * 60 * 60_000;

type MediaPayload = { mediaType?: string; mediaId?: string; filename?: string; link?: string };

/**
 * Copies customers' photos / videos / voice notes / documents from Meta to
 * Cloudinary and stores the URL as `payload.link`, which Chats already prefers.
 * Runs right after each webhook and on every tick, so a failed copy is retried.
 * ponytail: a file Meta will not hand over is retried every tick until it ages
 * past 30 days; mark it `lost` if that ever shows in the logs.
 */
export async function archiveInboundMedia(now = new Date()): Promise<number> {
  const rows = await prisma.message.findMany({
    where: { direction: "INBOUND", type: "MEDIA", createdAt: { gte: new Date(now.getTime() - META_KEEPS_MS) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, payload: true },
  });

  let copied = 0;
  for (const row of rows) {
    const p = row.payload as MediaPayload | null;
    if (!p?.mediaId || p.link) continue;
    try {
      const file = await downloadMedia(p.mediaId);
      if (!file) continue;
      const doc = p.mediaType === "document";
      // raw files keep their name only through the public id; images/video get theirs from the format.
      const ext = doc ? (p.filename?.match(/\.[\w]{1,8}$/)?.[0] ?? "") : "";
      const link = await uploadFile(await file.blob(), row.id + ext, doc ? "raw" : "auto");
      if (!link) continue;
      await prisma.message.update({ where: { id: row.id }, data: { payload: { ...p, link } } });
      copied++;
    } catch (err) {
      console.error("[archive] media copy failed", row.id, err instanceof Error ? err.message : err);
    }
  }
  return copied;
}
