import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { whatsapp, type OutboundMessage } from "@/lib/whatsapp/adapter";
import { FOLLOW_UP_AFTER_MS, type BrandPayload } from "./rules";
import {
  BRAND_LANGUAGE,
  GUIDE_FILENAME,
  GUIDE_PATH,
  GUIDE_TEXT,
  MEMBER_BUTTON,
  pickTemplate,
  thankYouText,
  type FunnelStep,
} from "./templates";

async function conversationId(customerId: string): Promise<string> {
  const open = await prisma.conversation.findFirst({
    where: { customerId, channel: "whatsapp", status: "OPEN" },
    select: { id: true },
  });
  if (open) return open.id;
  const created = await prisma.conversation.create({
    data: { customerId, channel: "whatsapp" },
    select: { id: true },
  });
  return created.id;
}

/**
 * The row exists before Meta is called, so a status webhook that races the
 * send only has to wait for one update, and a send is never left unrecorded.
 * Same order as src/lib/whatsapp/outbound.ts.
 */
export async function recordAndSend(
  customerId: string,
  message: OutboundMessage,
  row: { type: "TEMPLATE" | "TEXT" | "MEDIA"; body?: string; payload: Prisma.InputJsonValue },
  followUpAt?: Date,
): Promise<{ ok: boolean; error?: string }> {
  const stored = await prisma.message.create({
    data: {
      conversationId: await conversationId(customerId),
      customerId,
      direction: "OUTBOUND",
      deliveryStatus: "QUEUED",
      ...row,
    },
    select: { id: true },
  });
  const result = await whatsapp().send(message);
  await prisma.message.update({
    where: { id: stored.id },
    data: result.ok
      ? { providerMessageId: result.providerMessageId, followUpAt }
      : { deliveryStatus: "FAILED", failedAt: new Date(), failureCode: result.code },
  });
  return result.ok ? { ok: true } : { ok: false, error: result.message };
}

/**
 * One funnel template to one number. The row is stored whether or not Meta
 * accepted it, so a synchronous rejection shows on "Not delivered" too.
 * A number that tapped BRAND gets nothing but the thank-you, ever.
 */
export async function sendBrandMessage(input: {
  e164: string;
  name: string | null;
  step?: FunnelStep;
  retryOf?: string;
}): Promise<{ e164: string; ok: boolean; skipped?: "opted-out" | "brand-lead"; error?: string }> {
  const customer = await prisma.customer.upsert({
    where: { phoneE164: input.e164 },
    create: { phoneE164: input.e164, name: input.name },
    update: input.name ? { name: input.name } : {},
    select: { id: true, name: true, optedOutAt: true, qualifiedAt: true },
  });
  if (customer.optedOutAt) return { e164: input.e164, ok: false, skipped: "opted-out" };
  if (customer.qualifiedAt) return { e164: input.e164, ok: false, skipped: "brand-lead" };

  const step = input.step ?? 1;
  const pick = pickTemplate(step);
  const name = customer.name?.trim() || "Sir/Madam";
  const payload: BrandPayload = {
    kind: "brand",
    template: pick.template,
    image: pick.image,
    name,
    step,
    ...(input.retryOf && { retryOf: input.retryOf }),
  };
  const result = await recordAndSend(
    customer.id,
    {
      kind: "template",
      to: input.e164,
      templateKey: pick.template,
      language: BRAND_LANGUAGE,
      headerImageUrl: pick.image,
      variables: { name },
    },
    { type: "TEMPLATE", payload },
    new Date(Date.now() + FOLLOW_UP_AFTER_MS[step]),
  );
  return { e164: input.e164, ...result };
}

/**
 * The guide PDF with a MEMBER button, after a BRAND tap. Callers send it only
 * for the tap that qualified the lead, so a second tap sends nothing.
 * `origin` is this app's public URL; Meta fetches the PDF from it.
 */
export async function sendBrandGuide(
  customer: { id: string; phoneE164: string },
  origin: string,
): Promise<void> {
  await recordAndSend(
    customer.id,
    {
      kind: "media",
      to: customer.phoneE164,
      mediaType: "document",
      link: origin + GUIDE_PATH,
      filename: GUIDE_FILENAME,
      caption: GUIDE_TEXT,
      buttons: [MEMBER_BUTTON],
    },
    { type: "MEDIA", body: GUIDE_TEXT, payload: { kind: "brand_guide" } },
  );
}

/**
 * The thank-you after a MEMBER tap. Callers send it only for the tap that
 * claimed it, so a second tap or a replayed webhook sends nothing.
 */
export async function sendBrandThanks(customer: {
  id: string;
  phoneE164: string;
  name: string | null;
}): Promise<void> {
  const body = thankYouText(customer.name);
  await recordAndSend(
    customer.id,
    { kind: "text", to: customer.phoneE164, body },
    { type: "TEXT", body, payload: { kind: "brand_thanks" } },
  );
}
