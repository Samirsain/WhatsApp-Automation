"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { recordAndSend, sendBrandGuide } from "@/lib/brand/send";
import { signUpload, type UploadTicket } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";
import { isWindowOpen } from "@/lib/whatsapp/window";

export type DirectState = { error?: string; sentTo?: string };

/** A one-time signature for the browser to upload a file to Cloudinary. */
export async function getUploadTicket(): Promise<UploadTicket | null> {
  await assertPermission("batch:manage");
  return signUpload();
}

const input = z.object({
  customerId: z.uuid(),
  type: z.enum(["text", "image", "video", "audio", "document"]),
  text: z.string().trim().max(4096),
  link: z.string().trim(),
  filename: z.string().trim().max(240),
});

/** Only our own uploads go out, so nobody can make the business number send an arbitrary URL. */
const OUR_UPLOAD = /^https:\/\/res\.cloudinary\.com\/[\w-]+\/(image|video|raw)\/upload\/\S+$/;

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
    filename: formData.get("filename") ?? "",
  });
  if (!parsed.success) return { error: "Message is too long, or no chat is selected." };
  const { customerId, type, text, link, filename } = parsed.data;
  if (type === "text" && !text) return { error: "Write a message." };
  if (type !== "text") {
    if (!OUR_UPLOAD.test(link)) return { error: "The file did not upload. Attach it again." };
    if (text.length > 1024) return { error: "A caption can be at most 1024 characters." };
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
          { kind: "media", to, mediaType: type, link, caption: text || undefined, filename: filename || undefined },
          {
            type: "MEDIA",
            body: text || undefined,
            payload: { kind: "direct", mediaType: type, link, ...(filename && { filename }) },
          },
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

/**
 * The guide PDF with the MEMBER button, by hand, to an open chat — for people
 * who tapped Brand before the guide existed. Whoever gets their first guide
 * here moves to Brand Leads; a Member tap then makes them a Final Lead.
 */
export async function sendGuide(_prev: DirectState, formData: FormData): Promise<DirectState> {
  const user = await assertPermission("batch:manage");
  const customerId = z.uuid().safeParse(formData.get("customerId"));
  if (!customerId.success) return { error: "No chat is selected." };

  const customer = await prisma.customer.findUnique({
    where: { id: customerId.data },
    select: { id: true, phoneE164: true, optedOutAt: true, qualifiedAt: true },
  });
  if (!customer) return { error: "That customer no longer exists." };
  if (customer.optedOutAt) return { error: "This number has opted out of messages." };
  if (!(await isWindowOpen(customer.id))) {
    return { error: "This number's 24-hour window has closed. They need to message you first." };
  }

  const hadGuide = await prisma.message.count({
    where: { customerId: customer.id, payload: { path: ["kind"], equals: "brand_guide" } },
  });
  const h = await headers();
  const result = await sendBrandGuide(customer, `https://${h.get("x-forwarded-host") ?? h.get("host")}`);
  if (result.ok && hadGuide === 0) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { status: "IN_FUNNEL", qualifiedAt: customer.qualifiedAt ?? new Date() },
    });
  }

  await logActivity({
    actorUserId: user.id,
    eventType: result.ok ? "guide.sent" : "guide.failed",
    objectType: "customer",
    objectId: customer.id,
    metadata: { error: result.error ?? null },
  });
  revalidatePath("/message");
  return result.ok ? { sentTo: customer.phoneE164 } : { error: result.error ?? "Send failed." };
}
