import "server-only";
import { prisma } from "@/lib/prisma";
import { whatsapp } from "@/lib/whatsapp/adapter";
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
 * One brand template to one number. The row is stored whether or not Meta
 * accepted it, so a synchronous rejection shows on "Nahi gaye" too.
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
  const result = await whatsapp().send({
    kind: "template",
    to: input.e164,
    templateKey: pick.template,
    language: BRAND_LANGUAGE,
    headerImageUrl: pick.image,
    variables: { name },
  });

  const payload: BrandPayload = {
    kind: "brand",
    template: pick.template,
    image: pick.image,
    name,
    ...(input.retryOf && { retryOf: input.retryOf }),
  };
  await prisma.message.create({
    data: {
      conversationId: await conversationId(customer.id),
      customerId: customer.id,
      providerMessageId: result.ok ? result.providerMessageId : null,
      direction: "OUTBOUND",
      type: "TEMPLATE",
      payload,
      deliveryStatus: result.ok ? "QUEUED" : "FAILED",
      ...(!result.ok && { failedAt: new Date(), failureCode: result.code }),
    },
  });

  return result.ok
    ? { e164: input.e164, ok: true }
    : { e164: input.e164, ok: false, error: result.message };
}

/** Once per customer, ever: a second BRAND tap or a replayed webhook sends nothing. */
export async function sendBrandThanks(customer: {
  id: string;
  phoneE164: string;
  name: string | null;
}): Promise<void> {
  const already = await prisma.message.findFirst({
    where: {
      customerId: customer.id,
      direction: "OUTBOUND",
      payload: { path: ["kind"], equals: "brand_thanks" },
    },
    select: { id: true },
  });
  if (already) return;

  const body = thankYouText(customer.name);
  const result = await whatsapp().send({ kind: "text", to: customer.phoneE164, body });
  await prisma.message.create({
    data: {
      conversationId: await conversationId(customer.id),
      customerId: customer.id,
      providerMessageId: result.ok ? result.providerMessageId : null,
      direction: "OUTBOUND",
      type: "TEXT",
      body,
      payload: { kind: "brand_thanks" },
      deliveryStatus: result.ok ? "QUEUED" : "FAILED",
      ...(!result.ok && { failedAt: new Date(), failureCode: result.code }),
    },
  });
}
