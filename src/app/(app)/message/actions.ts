"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { recordAndSend } from "@/lib/brand/send";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";
import { isWindowOpen } from "@/lib/whatsapp/window";

export type DirectState = { error?: string; sentTo?: string };

const input = z.object({
  customerId: z.uuid(),
  type: z.enum(["text", "image", "video", "audio", "document"]),
  text: z.string().trim().max(4096),
  link: z.string().trim(),
});

/**
 * One message to one customer, outside any funnel. Only customers who wrote
 * in the last 24h can be picked — Meta rejects free-form sends outside that.
 */
export async function sendDirect(_prev: DirectState, formData: FormData): Promise<DirectState> {
  const user = await assertPermission("batch:manage");

  const parsed = input.safeParse({
    customerId: formData.get("customerId"),
    type: formData.get("type"),
    text: formData.get("text") ?? "",
    link: formData.get("link") ?? "",
  });
  if (!parsed.success) return { error: "Pick a number from the list." };
  const { customerId, type, text, link } = parsed.data;
  if (type === "text" && !text) return { error: "Write a message." };
  if (type !== "text" && !/^https:\/\/\S+$/.test(link)) {
    return { error: "Paste a public https:// link to the file." };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, phoneE164: true, optedOutAt: true },
  });
  if (!customer) return { error: "That customer no longer exists." };
  if (customer.optedOutAt) return { error: "This number has opted out of messages." };
  if (!(await isWindowOpen(customer.id))) {
    return { error: "This number's 24-hour window has closed. They need to message you first." };
  }

  const to = customer.phoneE164;
  const result =
    type === "text"
      ? await recordAndSend(
          customer.id,
          { kind: "text", to, body: text },
          { type: "TEXT", body: text, payload: { kind: "direct" } },
        )
      : await recordAndSend(
          customer.id,
          { kind: "media", to, mediaType: type, link, caption: text || undefined },
          { type: "MEDIA", body: text || undefined, payload: { kind: "direct", mediaType: type, link } },
        );

  await logActivity({
    actorUserId: user.id,
    eventType: result.ok ? "direct.sent" : "direct.failed",
    objectType: "customer",
    objectId: customer.id,
    metadata: { type, error: result.error ?? null },
  });
  revalidatePath("/message");
  return result.ok ? { sentTo: to } : { error: result.error ?? "Send failed." };
}
