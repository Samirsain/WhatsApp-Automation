import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { whatsapp, type OutboundMessage } from "@/lib/whatsapp/adapter";
import type { BrandPayload } from "./rules";
import { BRAND_LANGUAGE, pickTemplate, thankYouText, type BrandTemplate } from "./templates";

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
async function recordAndSend(
  customerId: string,
  message: OutboundMessage,
  row: { type: "TEMPLATE" | "TEXT"; body?: string; payload: Prisma.InputJsonValue },
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
      ? { providerMessageId: result.providerMessageId }
      : { deliveryStatus: "FAILED", failedAt: new Date(), failureCode: result.code },
  });
  return result.ok ? { ok: true } : { ok: false, error: result.message };
}

/**
 * One brand template to one number. The row is stored whether or not Meta
 * accepted it, so a synchronous rejection shows on "Not delivered" too.
 */
export async function sendBrandMessage(input: {
  e164: string;
  name: string | null;
  pick?: BrandTemplate;
  retryOf?: string;
}): Promise<{ e164: string; ok: boolean; skipped?: "opted-out"; error?: string }> {
  const customer = await prisma.customer.upsert({
    where: { phoneE164: input.e164 },
    create: { phoneE164: input.e164, name: input.name },
    update: input.name ? { name: input.name } : {},
    select: { id: true, name: true, optedOutAt: true },
  });
  if (customer.optedOutAt) return { e164: input.e164, ok: false, skipped: "opted-out" };

  const pick = input.pick ?? pickTemplate();
  const name = customer.name?.trim() || "Sir/Madam";
  const payload: BrandPayload = {
    kind: "brand",
    template: pick.template,
    image: pick.image,
    name,
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
  );
  return { e164: input.e164, ...result };
}

/**
 * The thank-you after a BRAND tap. Callers send it only for the tap that
 * qualified the lead, so a second tap or a replayed webhook sends nothing.
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
