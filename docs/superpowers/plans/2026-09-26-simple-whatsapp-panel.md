# Simple WhatsApp Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three staff screens in the existing Next.js app: Bulk bhejo (`/send`), Nahi gaye (`/failed`), BRAND leads (`/leads`), replacing the n8n workflow.

**Architecture:** Sends go straight to the Meta Cloud API through the existing adapter (`src/lib/whatsapp/adapter.ts`), bypassing the funnel engine. Every send is a `Message` row tagged `payload.kind = "brand"`. The existing webhook records delivery status; a BRAND reply marks the customer `QUALIFIED` and sends a thank-you once. A 131049 failure schedules one retry 24h later, which the existing tick route sends.

**Tech Stack:** Next.js 16.3.4 (App Router, server actions), React 19.2, Prisma 7 on PostgreSQL, Tailwind 4, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-26-simple-whatsapp-panel-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before writing Next.js code: this Next version has breaking changes (AGENTS.md). `searchParams` is a Promise.
- No new dependencies.
- Templates: `property_brand_1/2/3`, language `hi`, IMAGE header, body `{{1}}` = name; empty name → `Sir/Madam`.
- Max 200 rows per send.
- UI copy is Hinglish, as in the spec. Screen titles: "Bulk bhejo", "Nahi gaye", "BRAND leads".
- Tests are pure logic (`node:test`); nothing in tests touches the database, matching the repo.
- Checks before each commit: `npm run test` and `npm run typecheck`. Before the final commit also `npm run build` and `npx eslint src prisma --max-warnings=0`.
- The repo has **uncommitted changes that predate this plan** (`src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/qualified/page.tsx`, `src/app/globals.css`, `src/components/sidebar.tsx`, `src/components/ui.tsx`, `prisma/clear-test-data.ts`). Stage only the files each task names (`git add <paths>`), never `git add -A`. Task 7 edits `layout.tsx` and `sidebar.tsx` on top of those changes; keep them.

## Review Focus

1. **BRAND from a number the app never messaged** (leads n8n messaged before cutover): expect a customer to be created, qualified and thanked, not silently dropped. Pinned in Task 5.
2. **BRAND tapped twice, or Meta redelivers the webhook**: one thank-you, `qualifiedAt` keeps the first tap. Pinned in Task 5 (`isFirstBrandTap`) and by the existing `providerMessageId` dedupe.
3. **Two tick calls overlap** while a retry is due: the message is re-sent once. Pinned in Task 6 (claim by conditional `updateMany`).
4. **Staff manually re-sent before the auto-retry fired**: the auto-retry must not send a second copy. Enforced by the newer-message count in Task 6; checked by hand in Task 9 step 6 (the repo has no database tests).
5. **Row with a name containing a comma, or a CSV with a header row**: name kept whole, header skipped. Pinned in Task 3 (`rowsToText` + existing `parseNumberList`).

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/whatsapp/adapter.ts` (modify) | Header image in template sends; profile name on inbound messages |
| `src/lib/brand/templates.ts` (create) | The three templates, random pick, thank-you text |
| `src/lib/brand/rules.ts` (create) | Pure rules: BRAND detection, retry eligibility, failure reason/action, rows→text |
| `src/lib/brand/rules.test.ts` (create) | Tests for the two files above |
| `prisma/schema.prisma` + new migration (modify/create) | `messages.retryDueAt` |
| `src/lib/brand/send.ts` (create) | DB + API: send one brand message, send thank-you |
| `src/lib/brand/retry.ts` (create) | Send due 131049 retries |
| `src/lib/whatsapp/inbound.ts` (modify) | Retry scheduling, 131050 opt-out, BRAND handling |
| `src/app/api/automation/tick/route.ts` (modify) | Call `sendDueRetries` |
| `src/app/(app)/send/*` (create) | Bulk bhejo screen + action |
| `src/app/(app)/failed/*` (create) | Nahi gaye screen + resend action |
| `src/app/(app)/leads/page.tsx`, `src/app/api/leads/export/route.ts` (create) | BRAND leads + CSV |
| `src/lib/nav.ts`, `src/components/sidebar.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (modify) | Three-item sidebar, `/` → `/send` |
| `prisma/add-user.ts` (create), `package.json` (modify) | `npm run user:add` |

---

### Task 1: Adapter: header image and profile name

**Files:**
- Modify: `src/lib/whatsapp/adapter.ts`
- Test: `src/lib/whatsapp/adapter.test.ts`

**Interfaces:**
- Produces: `OutboundTemplate.headerImageUrl?: string`; exported pure `buildMetaPayload(message: OutboundMessage): Record<string, unknown>`; inbound message event gains `profileName?: string`.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/whatsapp/adapter.test.ts`; add `buildMetaPayload` to the existing import from `./adapter`)

```ts
test("template payload carries a header image and the body name", () => {
  const payload = buildMetaPayload({
    kind: "template",
    to: "+919876543210",
    templateKey: "property_brand_1",
    language: "hi",
    headerImageUrl: "https://img.example/a.jpg",
    variables: { name: "Rahul" },
  }) as { template: { components: unknown[] } };

  assert.deepEqual(payload.template.components, [
    { type: "header", parameters: [{ type: "image", image: { link: "https://img.example/a.jpg" } }] },
    { type: "body", parameters: [{ type: "text", text: "Rahul" }] },
  ]);
});

test("template payload without image or variables has no components", () => {
  const payload = buildMetaPayload({
    kind: "template",
    to: "+919876543210",
    templateKey: "hello",
    language: "en",
  }) as { template: Record<string, unknown> };
  assert.equal("components" in payload.template, false);
});

test("inbound message carries the contact's profile name", () => {
  const [event] = adapter.parseWebhook({
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: "919352410667", profile: { name: "Samir Sain" } }],
      messages: [{ id: "wamid.9", from: "919352410667", timestamp: "1700000000",
        type: "button", button: { text: "BRAND", payload: "BRAND" } }],
    } }] }],
  });
  assert.equal(event.kind, "message");
  assert.equal(event.kind === "message" && event.profileName, "Samir Sain");
  assert.equal(event.kind === "message" && event.text, "BRAND");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test`
Expected: FAIL — `buildMetaPayload` is not exported; `profileName` undefined.

- [ ] **Step 3: Implement**

In `OutboundTemplate` add:

```ts
  /** Public URL of the header image, for templates with an IMAGE header. */
  headerImageUrl?: string;
```

In the `kind: "message"` member of `InboundEvent` add:

```ts
      /** WhatsApp profile name of the sender, when Meta includes it. */
      profileName?: string;
```

In `MetaChange.value` add:

```ts
    contacts?: { wa_id?: string; profile?: { name?: string } }[];
```

Add above `const metaAdapter`:

```ts
/** The Cloud API request body for one message. Pure, so it can be tested. */
export function buildMetaPayload(message: OutboundMessage): Record<string, unknown> {
  if (message.kind === "text") {
    return { messaging_product: "whatsapp", to: message.to, type: "text", text: { body: message.body } };
  }
  const components = [
    ...(message.headerImageUrl
      ? [{ type: "header", parameters: [{ type: "image", image: { link: message.headerImageUrl } }] }]
      : []),
    ...(message.variables
      ? [{
          type: "body",
          parameters: Object.values(message.variables).map((text) => ({ type: "text", text })),
        }]
      : []),
  ];
  return {
    messaging_product: "whatsapp",
    to: message.to,
    type: "template",
    template: {
      name: message.templateKey,
      language: { code: message.language },
      ...(components.length > 0 && { components }),
    },
  };
}
```

In `metaAdapter.send`, replace the whole `const payload = message.kind === "text" ? {...} : {...};` expression with:

```ts
    const payload = buildMetaPayload(message);
```

In `parseWebhook`, inside `for (const change of ...)` before the messages loop:

```ts
        const contacts = change.value?.contacts ?? [];
```

and in the pushed message event add:

```ts
            profileName:
              contacts.find((c) => c.wa_id === m.from?.replace(/^\+/, ""))?.profile?.name ??
              contacts[0]?.profile?.name,
```

- [ ] **Step 4: Run tests**

Run: `npm run test && npm run typecheck`
Expected: PASS, including the pre-existing adapter tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/adapter.ts src/lib/whatsapp/adapter.test.ts
git commit -m "feat: template header images and sender profile name in the WhatsApp adapter"
```

---

### Task 2: Brand templates and pure rules

**Files:**
- Create: `src/lib/brand/templates.ts`, `src/lib/brand/rules.ts`
- Test: `src/lib/brand/rules.test.ts`

**Interfaces:**
- Produces:
  - `type BrandTemplate = { template: string; image: string }`
  - `BRAND_TEMPLATES: readonly BrandTemplate[]`, `BRAND_LANGUAGE = "hi"`
  - `pickTemplate(random?: () => number): BrandTemplate`
  - `thankYouText(name: string | null): string`
  - `type BrandPayload = { kind: "brand"; template: string; image: string; name: string; retryOf?: string }`
  - `isBrandReply(text: string, replyId?: string | null): boolean`
  - `RETRY_AFTER_MS = 86_400_000`
  - `retryDueAt(failureCode: string | undefined, payload: unknown, failedAt: Date): Date | null`
  - `failureReason(code: string | null): string`
  - `failureAction(code: string | null, retryDueAt: Date | null): "auto" | "resend" | "none"`
  - `rowsToText(rows: { name: string; number: string }[]): string`
  - `isFirstBrandTap(qualifiedAt: Date | null): boolean`

- [ ] **Step 1: Write the failing tests** — `src/lib/brand/rules.test.ts`

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseNumberList } from "../numbers/parse-list";
import {
  failureAction, failureReason, isBrandReply, isFirstBrandTap, retryDueAt,
  rowsToText, RETRY_AFTER_MS,
} from "./rules";
import { BRAND_TEMPLATES, pickTemplate, thankYouText } from "./templates";

const brand = { kind: "brand", template: "property_brand_1", image: "x", name: "A" };

test("pickTemplate returns each of the three at the edges of the range", () => {
  assert.equal(pickTemplate(() => 0).template, "property_brand_1");
  assert.equal(pickTemplate(() => 0.5).template, "property_brand_2");
  assert.equal(pickTemplate(() => 0.9999).template, "property_brand_3");
  assert.equal(pickTemplate(() => 1).template, "property_brand_3");
  assert.equal(BRAND_TEMPLATES.length, 3);
});

test("thank-you uses the name when known and falls back cleanly", () => {
  assert.match(thankYouText("Samir"), /^धन्यवाद Samir जी/);
  assert.match(thankYouText(null), /^धन्यवाद जी/);
  assert.match(thankYouText("  "), /^धन्यवाद जी/);
});

test("isBrandReply matches button text, payload, case and spaces only for BRAND", () => {
  assert.equal(isBrandReply("BRAND"), true);
  assert.equal(isBrandReply(" brand "), true);
  assert.equal(isBrandReply("", "BRAND"), true);
  assert.equal(isBrandReply("Hi"), false);
  assert.equal(isBrandReply("brand please"), false);
});

test("retryDueAt only for a first-time 131049 brand failure", () => {
  const at = new Date("2026-09-26T05:00:00Z");
  assert.equal(retryDueAt("131049", brand, at)?.getTime(), at.getTime() + RETRY_AFTER_MS);
  assert.equal(retryDueAt("131026", brand, at), null);
  assert.equal(retryDueAt(undefined, brand, at), null);
  assert.equal(retryDueAt("131049", { ...brand, retryOf: "m1" }, at), null);
  assert.equal(retryDueAt("131049", { kind: "brand_thanks" }, at), null);
  assert.equal(retryDueAt("131049", null, at), null);
});

test("failure reasons are plain Hindi and unknown codes show the code", () => {
  assert.match(failureReason("131049"), /Meta ne roka/);
  assert.match(failureReason("131026"), /WhatsApp/);
  assert.equal(failureReason("999"), "Meta ne bheja nahi (code 999)");
  assert.equal(failureReason(null), "Meta ne bheja nahi");
});

test("failure action: auto while a retry is pending, none when opted out", () => {
  assert.equal(failureAction("131049", new Date()), "auto");
  assert.equal(failureAction("131049", null), "resend");
  assert.equal(failureAction("131050", null), "none");
  assert.equal(failureAction("131026", null), "resend");
});

test("rowsToText keeps comma names whole and parseNumberList reads them", () => {
  const text = rowsToText([
    { name: "Sharma, Rahul", number: "98765 43210" },
    { name: "", number: "" },
    { name: "", number: "9812345678" },
  ]);
  const parsed = parseNumberList(text);
  assert.equal(parsed.valid.length, 2);
  assert.equal(parsed.valid[0].name, "Sharma, Rahul");
  assert.equal(parsed.valid[0].e164, "+919876543210");
  assert.equal(parsed.valid[1].name, null);
});

test("a CSV header row is skipped by parseNumberList", () => {
  const parsed = parseNumberList("name,number\nRahul,9876543210");
  assert.equal(parsed.valid.length, 1);
  assert.equal(parsed.rejected.length, 0);
});

test("only the first BRAND tap qualifies", () => {
  assert.equal(isFirstBrandTap(null), true);
  assert.equal(isFirstBrandTap(new Date()), false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test`
Expected: FAIL — cannot find module `./rules` / `./templates`.

- [ ] **Step 3: Implement** — `src/lib/brand/templates.ts`

```ts
/**
 * The three approved property-brand templates (MARKETING, hi, IMAGE header,
 * body {{1}} = name, quick reply "BRAND"). Same values the n8n workflow used.
 * Not editable in the UI: a change here needs a newly approved template anyway.
 */
export type BrandTemplate = { template: string; image: string };

export const BRAND_LANGUAGE = "hi";

export const BRAND_TEMPLATES: readonly BrandTemplate[] = [
  { template: "property_brand_1", image: "https://res.cloudinary.com/dn7bbf8cp/image/upload/v1790311483/d5d81305-e7a9-423b-8d61-115b617be8c2_o2ugry.jpg" },
  { template: "property_brand_2", image: "https://res.cloudinary.com/dn7bbf8cp/image/upload/v1790311490/222fac9b-84bb-41a4-80b3-e70409ec655d_uovoqs.jpg" },
  { template: "property_brand_3", image: "https://res.cloudinary.com/dn7bbf8cp/image/upload/v1790311500/b6399380-9d9e-48f3-8ce9-161fd0c0b2d1_t4sqlt.jpg" },
];

export function pickTemplate(random: () => number = Math.random): BrandTemplate {
  const i = Math.min(BRAND_TEMPLATES.length - 1, Math.floor(random() * BRAND_TEMPLATES.length));
  return BRAND_TEMPLATES[i];
}

/** Sent once after a BRAND tap. Free: it goes inside the 24h window the tap opened. */
export function thankYouText(name: string | null): string {
  const who = name?.trim() ? `${name.trim()} ` : "";
  return `धन्यवाद ${who}जी 🙏\nआपकी request हमें मिल गई है।\nहमारी टीम जल्द ही आपसे संपर्क करके आपका PROPERTY BRAND BLUEPRINT शेयर करेगी। ✅\n— 3% Real Estate Club`;
}
```

`src/lib/brand/rules.ts`

```ts
/** Pure rules for the brand panel. No database, no network. */

export type BrandPayload = {
  kind: "brand";
  template: string;
  image: string;
  name: string;
  /** Id of the failed message this one re-sends. */
  retryOf?: string;
};

export function isBrandReply(text: string, replyId?: string | null): boolean {
  return [text, replyId].some((v) => (v ?? "").trim().toUpperCase() === "BRAND");
}

export const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * 131049 is Meta's per-user marketing limit; Meta advises waiting a day.
 * Only a first attempt is retried, so a number is never tried a third time.
 */
export function retryDueAt(
  failureCode: string | undefined,
  payload: unknown,
  failedAt: Date,
): Date | null {
  if (failureCode !== "131049") return null;
  const p = payload as Partial<BrandPayload> | null;
  if (p?.kind !== "brand" || p.retryOf) return null;
  return new Date(failedAt.getTime() + RETRY_AFTER_MS);
}

const REASONS: Record<string, string> = {
  "131049": "Meta ne roka (marketing limit)",
  "131026": "Is number pe WhatsApp nahi hai / message nahi pahuncha",
  "131050": "User ne marketing messages band kiye hain",
  "131042": "Payment ki dikkat – Meta billing check karo",
  "131047": "24 ghante ki window band",
  "130472": "Meta experiment ki wajah se roka",
};

export function failureReason(code: string | null): string {
  if (!code) return "Meta ne bheja nahi";
  return REASONS[code] ?? `Meta ne bheja nahi (code ${code})`;
}

export function failureAction(code: string | null, retryDueAt: Date | null): "auto" | "resend" | "none" {
  if (code === "131050") return "none";
  if (retryDueAt) return "auto";
  return "resend";
}

/**
 * Screen rows → the "name,number" lines `parseNumberList` reads. The number is
 * the last field there, so a name with a comma survives. Empty rows drop out.
 */
export function rowsToText(rows: { name: string; number: string }[]): string {
  return rows
    .filter((r) => r.number.trim() !== "")
    .map((r) => `${r.name.trim()},${r.number.trim()}`)
    .join("\n");
}

export function isFirstBrandTap(qualifiedAt: Date | null): boolean {
  return qualifiedAt === null;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brand/templates.ts src/lib/brand/rules.ts src/lib/brand/rules.test.ts
git commit -m "feat: brand templates and the pure rules for sending, retrying and BRAND replies"
```

---

### Task 3: `retryDueAt` column

**Files:**
- Modify: `prisma/schema.prisma` (model `Message`)
- Create: `prisma/migrations/20260926000000_message_retry_due_at/migration.sql`

**Interfaces:**
- Produces: `Message.retryDueAt: DateTime | null`, indexed.

- [ ] **Step 1: Edit the schema.** In `model Message`, after `failureCode String?` add:

```prisma
  /// Set when a brand message failed with 131049; the tick route re-sends it once.
  retryDueAt        DateTime?
```

and next to the other `@@index` lines:

```prisma
  @@index([retryDueAt])
```

- [ ] **Step 2: Write the migration** — `prisma/migrations/20260926000000_message_retry_due_at/migration.sql`

```sql
-- AlterTable
ALTER TABLE "messages" ADD COLUMN "retryDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "messages_retryDueAt_idx" ON "messages"("retryDueAt");
```

- [ ] **Step 3: Validate and regenerate**

Run: `npx prisma validate && npx prisma generate && npm run typecheck`
Expected: "The schema is valid", client generated, typecheck PASS.

Railway applies it on deploy (`startCommand` runs `npx prisma migrate deploy`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260926000000_message_retry_due_at
git commit -m "feat: retryDueAt on messages for the 131049 retry"
```

---

### Task 4: Sending a brand message and the thank-you

**Files:**
- Create: `src/lib/brand/send.ts`

**Interfaces:**
- Consumes: `buildMetaPayload`/`whatsapp()` (Task 1), `pickTemplate`, `BRAND_LANGUAGE`, `thankYouText` (Task 2), `BrandPayload`.
- Produces:
  - `sendBrandMessage(input: { e164: string; name: string | null; pick?: BrandTemplate; retryOf?: string }): Promise<{ e164: string; ok: boolean; skipped?: "opted-out"; error?: string }>`
  - `sendBrandThanks(customer: { id: string; phoneE164: string; name: string | null }): Promise<void>`

No unit test: this file is database and network only, and the repo has no database tests. Its behaviour is exercised by the manual check in Task 9.

- [ ] **Step 1: Implement** — `src/lib/brand/send.ts`

```ts
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

  return result.ok ? { e164: input.e164, ok: true } : { e164: input.e164, ok: false, error: result.message };
}

/** Once per customer, ever: a second BRAND tap or a replayed webhook sends nothing. */
export async function sendBrandThanks(customer: {
  id: string;
  phoneE164: string;
  name: string | null;
}): Promise<void> {
  const already = await prisma.message.findFirst({
    where: { customerId: customer.id, direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand_thanks" } },
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/brand/send.ts
git commit -m "feat: send a brand template and the one-time thank-you"
```

---

### Task 5: Webhook: retry scheduling, opt-out, BRAND

**Files:**
- Modify: `src/lib/whatsapp/inbound.ts`

**Interfaces:**
- Consumes: `retryDueAt`, `isBrandReply`, `isFirstBrandTap` (Task 2), `sendBrandThanks` (Task 4), `profileName` (Task 1).

The pure decisions are tested in Task 2. This task wires them in.

- [ ] **Step 1: Imports.** Add to `src/lib/whatsapp/inbound.ts`:

```ts
import { isBrandReply, isFirstBrandTap, retryDueAt } from "@/lib/brand/rules";
import { sendBrandThanks } from "@/lib/brand/send";
```

- [ ] **Step 2: `applyStatus`.** Change the `select` to `{ id: true, deliveryStatus: true, payload: true, customerId: true }`. In the `FAILED` spread of the update add `retryDueAt: retryDueAt(event.failureCode, message.payload, event.at),`. After the update, before `return true;`:

```ts
  // 131050: the person turned off marketing messages. Never send to them again.
  if (event.status === "FAILED" && event.failureCode === "131050") {
    await prisma.customer.updateMany({
      where: { id: message.customerId, optedOutAt: null },
      data: { optedOutAt: event.at },
    });
  }
```

- [ ] **Step 3: BRAND from an unknown number.** In `applyInboundMessage`, replace the start of the unknown-customer branch so that a BRAND tap creates the customer instead of being dropped (numbers n8n messaged before cutover are not in this database):

```ts
  let customer = await prisma.customer.findUnique({
    where: { phoneE164: event.from },
    select: { id: true },
  });

  // A BRAND tap is a lead even if this app never messaged the number
  // (n8n did, before cutover). Anything else from a stranger is still ignored.
  if (!customer && isBrandReply(event.text, event.replyId)) {
    customer = await prisma.customer.create({
      data: { phoneE164: event.from, name: event.profileName ?? null },
      select: { id: true },
    });
  }
```

(Keep the existing `if (!customer) { logActivity...; return "unknown-customer"; }` block after it; change the original `const customer` declaration to the `let` above.)

- [ ] **Step 4: BRAND handling.** After the opt-out block (`if (await isOptOut(...)) {...}`) and before `await applyCustomerResponse(...)`:

```ts
  if (isBrandReply(event.text, event.replyId)) {
    const lead = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      select: { id: true, phoneE164: true, name: true, qualifiedAt: true },
    });
    const name = lead.name ?? event.profileName ?? null;
    if (isFirstBrandTap(lead.qualifiedAt)) {
      await prisma.customer.update({
        where: { id: lead.id },
        data: { status: "QUALIFIED", qualifiedAt: event.receivedAt, name },
      });
      await logActivity({
        eventType: "customer.brand_tapped",
        objectType: "customer",
        objectId: lead.id,
        customerId: lead.id,
      });
    }
    await sendBrandThanks({ id: lead.id, phoneE164: lead.phoneE164, name });
    return "ok";
  }
```

- [ ] **Step 5: Checks**

Run: `npm run test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/whatsapp/inbound.ts
git commit -m "feat: BRAND replies qualify and thank the lead; 131049 schedules a retry; 131050 opts out"
```

---

### Task 6: Due retries on tick

**Files:**
- Create: `src/lib/brand/retry.ts`
- Modify: `src/app/api/automation/tick/route.ts`

**Interfaces:**
- Consumes: `sendBrandMessage` (Task 4), `BrandPayload` (Task 2).
- Produces: `sendDueRetries(now?: Date): Promise<{ sent: number; skipped: number }>`

- [ ] **Step 1: Implement** — `src/lib/brand/retry.ts`

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { BrandPayload } from "./rules";
import { sendBrandMessage } from "./send";

/**
 * Re-send brand messages whose 131049 retry is due. Each row is claimed by
 * clearing retryDueAt with a conditional update, so two overlapping ticks
 * cannot both send it.
 */
export async function sendDueRetries(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const due = await prisma.message.findMany({
    where: { retryDueAt: { lte: now } },
    select: { id: true, createdAt: true, customerId: true, payload: true, customer: { select: { phoneE164: true } } },
    take: 50, // ponytail: 50 per tick; raise if a day's failures outgrow it
  });

  let sent = 0;
  let skipped = 0;
  for (const m of due) {
    const claim = await prisma.message.updateMany({
      where: { id: m.id, retryDueAt: { not: null } },
      data: { retryDueAt: null },
    });
    if (claim.count !== 1) continue;

    const newer = await prisma.message.count({
      where: {
        customerId: m.customerId,
        direction: "OUTBOUND",
        createdAt: { gt: m.createdAt },
        payload: { path: ["kind"], equals: "brand" },
      },
    });
    // A manual resend in the meantime already covers the number.
    if (newer > 0) {
      skipped++;
      continue;
    }

    const p = m.payload as BrandPayload;
    await sendBrandMessage({
      e164: m.customer.phoneE164,
      name: null,
      pick: { template: p.template, image: p.image },
      retryOf: m.id,
    });
    sent++;
  }
  return { sent, skipped };
}
```

- [ ] **Step 2: Wire into tick.** In `src/app/api/automation/tick/route.ts` add `import { sendDueRetries } from "@/lib/brand/retry";` and change the `try` body to:

```ts
    const automations = await tick();
    const batches = await dispatchRunningBatches();
    const retries = await sendDueRetries();
    return NextResponse.json({ automations, batches, retries });
```

- [ ] **Step 3: Checks**

Run: `npm run test && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/brand/retry.ts src/app/api/automation/tick/route.ts
git commit -m "feat: tick re-sends due 131049 retries once"
```

---

### Task 7: The three screens and the sidebar

**Files:**
- Create: `src/app/(app)/send/page.tsx`, `src/app/(app)/send/send-form.tsx`, `src/app/(app)/send/actions.ts`
- Create: `src/app/(app)/failed/page.tsx`, `src/app/(app)/failed/actions.ts`
- Create: `src/app/(app)/leads/page.tsx`, `src/app/api/leads/export/route.ts`
- Modify: `src/lib/nav.ts`, `src/components/sidebar.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `parseNumberList` (existing), `rowsToText`, `failureReason`, `failureAction` (Task 2), `sendBrandMessage` (Task 4), `BrandPayload`.
- Produces: `sendBulk(prev: SendState, formData: FormData): Promise<SendState>` with `SendState = { error?: string; sent?: number; failed?: number; skipped?: number; rejected?: { raw: string; reason: string }[] }`; `resendBrand(formData: FormData): Promise<void>`.

Before writing: read `node_modules/next/dist/docs/` on server actions, `useActionState` and route handlers.

- [ ] **Step 1: Send action** — `src/app/(app)/send/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { sendBrandMessage } from "@/lib/brand/send";
import { parseNumberList } from "@/lib/numbers/parse-list";
import { assertPermission } from "@/lib/session";

export type SendState = {
  error?: string;
  sent?: number;
  failed?: number;
  skipped?: number;
  rejected?: { raw: string; reason: string }[];
};

const MAX_ROWS = 200;

export async function sendBulk(_prev: SendState, formData: FormData): Promise<SendState> {
  const user = await assertPermission("batch:manage");
  const text = String(formData.get("rows") ?? "");
  const parsed = parseNumberList(text);
  if (parsed.valid.length === 0) {
    return { error: "Kam se kam ek sahi number daalo.", rejected: parsed.rejected };
  }
  if (parsed.valid.length > MAX_ROWS) {
    return { error: `Ek baar mein ${MAX_ROWS} tak numbers bhejo.` };
  }

  let sent = 0, failed = 0, skipped = 0;
  // ponytail: sequential inside the request; move to the tick worker if lists grow past a few hundred
  for (const row of parsed.valid) {
    const r = await sendBrandMessage({ e164: row.e164, name: row.name });
    if (r.ok) sent++;
    else if (r.skipped) skipped++;
    else failed++;
  }

  await logActivity({
    actorUserId: user.id,
    eventType: "brand.bulk_sent",
    objectType: "send",
    metadata: { sent, failed, skipped, rejected: parsed.rejected.length },
  });
  revalidatePath("/failed");
  return { sent, failed, skipped, rejected: parsed.rejected };
}
```

- [ ] **Step 2: Send form (client)** — `src/app/(app)/send/send-form.tsx`

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass, ErrorNote, inputClass } from "@/components/ui";
import { rowsToText } from "@/lib/brand/rules";
import { sendBulk, type SendState } from "./actions";

type RowInput = { name: string; number: string };
const blank = (n: number): RowInput[] => Array.from({ length: n }, () => ({ name: "", number: "" }));

export function SendForm() {
  const [rows, setRows] = useState<RowInput[]>(blank(5));
  const [state, action, pending] = useActionState<SendState, FormData>(sendBulk, {});
  const filled = rows.filter((r) => r.number.trim() !== "").length;

  function update(i: number, key: keyof RowInput, value: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }

  async function loadCsv(file: File) {
    const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim() !== "");
    const loaded = lines.map((line) => {
      const parts = line.split(",");
      return { name: parts.slice(0, -1).join(",").trim(), number: (parts.at(-1) ?? "").trim() };
    });
    // A header row has no digits in the number column.
    setRows(loaded.filter((r) => /\d/.test(r.number)));
  }

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-3">
      <input type="hidden" name="rows" value={rowsToText(rows)} />
      <div className="grid grid-cols-[1fr_1fr] gap-2 text-[length:var(--text-small)] font-medium">
        <span>Naam</span>
        <span>Number</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr] gap-2">
          <input aria-label={`Naam ${i + 1}`} className={inputClass} placeholder="Rahul"
            value={r.name} onChange={(e) => update(i, "name", e.target.value)} />
          <input aria-label={`Number ${i + 1}`} className={inputClass} placeholder="9876543210"
            inputMode="tel" value={r.number} onChange={(e) => update(i, "number", e.target.value)} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass.secondary}
          onClick={() => setRows((rs) => [...rs, ...blank(1)])}>
          + aur jodo
        </button>
        <label className={buttonClass.secondary}>
          CSV upload
          <input type="file" accept=".csv,text/csv" className="sr-only"
            onChange={(e) => e.target.files?.[0] && loadCsv(e.target.files[0])} />
        </label>
      </div>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {state.rejected && state.rejected.length > 0 && (
        <ErrorNote>
          Ye numbers galat hain, nahi bheje: {state.rejected.map((r) => `${r.raw} (${r.reason})`).join(" · ")}
        </ErrorNote>
      )}
      {state.sent !== undefined && (
        <p role="status" className="rounded-[var(--radius-sm)] border border-[color:var(--color-border-default)] px-2.5 py-1.5">
          Bheje gaye: <b>{state.sent}</b> · Fail: <b>{state.failed}</b> · Skip (opt-out): <b>{state.skipped}</b>
          {" — "}
          <Link href="/failed" className="underline">Nahi gaye dekho</Link>
        </p>
      )}

      <button type="submit" disabled={pending || filled === 0} className={buttonClass.primary}>
        {pending ? "Bhej rahe hain…" : `Messages bhejo (${filled})`}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Send page** — `src/app/(app)/send/page.tsx`

```tsx
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/session";
import { SendForm } from "./send-form";

export const dynamic = "force-dynamic";

export default async function SendPage() {
  await requirePermission("batch:manage");
  return (
    <>
      <PageHeader
        title="Bulk bhejo"
        description="Naam aur number bharo. Har number ko 3 property brand templates mein se ek random jayega."
      />
      <SendForm />
    </>
  );
}
```

- [ ] **Step 4: Resend action** — `src/app/(app)/failed/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { BrandPayload } from "@/lib/brand/rules";
import { sendBrandMessage } from "@/lib/brand/send";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

export async function resendBrand(formData: FormData): Promise<void> {
  await assertPermission("batch:manage");
  const id = String(formData.get("messageId") ?? "");
  const m = await prisma.message.findUnique({
    where: { id },
    select: { id: true, payload: true, customer: { select: { phoneE164: true } } },
  });
  const p = m?.payload as BrandPayload | null;
  if (!m || p?.kind !== "brand") return;
  await sendBrandMessage({
    e164: m.customer.phoneE164,
    name: null,
    pick: { template: p.template, image: p.image },
    retryOf: m.id,
  });
  revalidatePath("/failed");
}
```

- [ ] **Step 5: Failed page** — `src/app/(app)/failed/page.tsx`

```tsx
import { Badge, Card, Cell, EmptyState, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { failureAction, failureReason } from "@/lib/brand/rules";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { resendBrand } from "./actions";

export const dynamic = "force-dynamic";

/** A number is listed while its latest brand message is FAILED. */
export default async function FailedPage() {
  await requirePermission("batch:read");

  const recent = await prisma.message.findMany({
    where: { direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand" } },
    orderBy: { createdAt: "desc" },
    take: 2000, // ponytail: newest 2000 sends; paginate if the list outgrows it
    select: {
      id: true, customerId: true, deliveryStatus: true, failureCode: true,
      failedAt: true, createdAt: true, retryDueAt: true,
      customer: { select: { name: true, phoneE164: true } },
    },
  });
  const seen = new Set<string>();
  const failed = recent.filter((m) => {
    if (seen.has(m.customerId)) return false;
    seen.add(m.customerId);
    return m.deliveryStatus === "FAILED";
  });

  return (
    <>
      <PageHeader title="Nahi gaye" description="In numbers pe message nahi pahuncha. Wajah aur aage kya karna hai, yahin dikhega." />
      <Card flush>
        {failed.length === 0 ? (
          <EmptyState title="Sab messages chale gaye" description="Koi fail hua to yahan dikhega." />
        ) : (
          <Table head={["Naam", "Number", "Kab", "Wajah", ""]} caption="Messages jo nahi pahunche">
            {failed.map((m) => {
              const action = failureAction(m.failureCode, m.retryDueAt);
              return (
                <Row key={m.id}>
                  <Cell>{m.customer.name ?? "—"}</Cell>
                  <Cell className="tabular-nums">{m.customer.phoneE164}</Cell>
                  <Cell>{formatDateTime(m.failedAt ?? m.createdAt)}</Cell>
                  <Cell>{failureReason(m.failureCode)}</Cell>
                  <Cell>
                    {action === "auto" && <Badge tone="info">Kal apne aap dobara jayega</Badge>}
                    {action === "resend" && (
                      <form action={resendBrand}>
                        <input type="hidden" name="messageId" value={m.id} />
                        <button type="submit" className={buttonClass.secondary}>Dobara bhejo</button>
                      </form>
                    )}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
```

Check `Badge`'s `tone` prop values in `src/components/ui.tsx` (line ~140) and use an existing one if `"info"` is not among them (`layout.tsx` already uses `tone="info"`). Check `formatDateTime`'s signature in `src/lib/format.ts`.

- [ ] **Step 6: Leads page** — `src/app/(app)/leads/page.tsx`

```tsx
import { Card, Cell, EmptyState, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requirePermission("qualified:read");
  const leads = await prisma.customer.findMany({
    where: { status: "QUALIFIED" },
    orderBy: { qualifiedAt: "desc" },
    select: { id: true, name: true, phoneE164: true, qualifiedAt: true },
  });

  return (
    <>
      <PageHeader
        title="BRAND leads"
        description="Jinhone BRAND button dabaya. Inhe thank-you message apne aap chala gaya hai."
        actions={<a href="/api/leads/export" className={buttonClass.secondary}>CSV download</a>}
      />
      <Card flush>
        {leads.length === 0 ? (
          <EmptyState title="Abhi koi lead nahi" description="Koi BRAND dabayega to yahan dikhega." />
        ) : (
          <Table head={["Naam", "Number", "Kab click kiya"]} caption="BRAND leads">
            {leads.map((l) => (
              <Row key={l.id}>
                <Cell>{l.name ?? "—"}</Cell>
                <Cell className="tabular-nums">{l.phoneE164}</Cell>
                <Cell>{l.qualifiedAt ? formatDateTime(l.qualifiedAt) : "—"}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
```

- [ ] **Step 7: Leads CSV** — `src/app/api/leads/export/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

function csv(value: string | null | undefined): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET() {
  await requirePermission("qualified:export");
  const leads = await prisma.customer.findMany({
    where: { status: "QUALIFIED" },
    orderBy: { qualifiedAt: "desc" },
    select: { name: true, phoneE164: true, qualifiedAt: true },
  });
  const body = leads
    .map((l) => [csv(l.name), csv(l.phoneE164), csv(l.qualifiedAt?.toISOString())].join(","))
    .join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel reads Hindi names correctly.
  return new NextResponse(`﻿name,phone,clicked_at\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-leads-${stamp}.csv"`,
    },
  });
}
```

- [ ] **Step 8: Nav.** Replace the body of `src/lib/nav.ts` below the imports:

```ts
/** Three screens, nothing else: send, see what failed, see who tapped BRAND. */
export type NavIcon = "send" | "failed" | "leads";

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: NavIcon;
};

export const NAV: NavItem[] = [
  { href: "/send", label: "Bulk bhejo", permission: "batch:manage", icon: "send" },
  { href: "/failed", label: "Nahi gaye", permission: "batch:read", icon: "failed" },
  { href: "/leads", label: "BRAND leads", permission: "qualified:read", icon: "leads" },
];
```

In `src/components/sidebar.tsx`: replace the `ICONS` object with

```tsx
const ICONS: Record<NavIcon, React.ReactNode> = {
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  failed: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  leads: <path d="M20 6 9 17l-5-5" />,
};
```

and replace the `groups.map(...)` block with a single list over `items` (same `<li>`/`<Link>` markup as now, without the group heading). Delete the `paused` prop, its type entry and the "All funnels paused" block (the emergency stop lives on `/settings`, which is no longer linked).

In `src/app/(app)/layout.tsx`: replace the `Promise.all` with

```ts
  const [unread, leads] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.customer.count({ where: { status: "QUALIFIED" } }),
  ]);
```

pass `counts={{ "/leads": leads }}`, remove `paused=...`, and remove the now-unused `getSetting` import.

In `src/app/(app)/page.tsx`: `redirect("/send")`.

- [ ] **Step 9: Checks**

Run: `npm run test && npm run typecheck && npx eslint src prisma --max-warnings=0 && npm run build`
Expected: all PASS. Fix any unused-import errors left by the old nav (e.g. pages still importing removed `NavIcon` values).

- [ ] **Step 10: Look at it.** `npm run dev`, sign in, open `/send`, `/failed`, `/leads`: the sidebar shows exactly three items; `/` lands on `/send`; the form adds a row, loads a CSV with a header row, and the button counts filled rows. Do **not** submit against the real Meta account from local dev unless the owner is watching.

- [ ] **Step 11: Commit**

```bash
git add "src/app/(app)/send" "src/app/(app)/failed" "src/app/(app)/leads" src/app/api/leads src/lib/nav.ts src/components/sidebar.tsx "src/app/(app)/layout.tsx" "src/app/(app)/page.tsx"
git commit -m "feat: Bulk bhejo, Nahi gaye and BRAND leads screens with a three-item sidebar"
```

(This also commits the owner's earlier uncommitted edits in `layout.tsx` and `sidebar.tsx`; say so in the hand-off.)

---

### Task 8: `npm run user:add`

**Files:**
- Create: `prisma/add-user.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Implement** — `prisma/add-user.ts`

```ts
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** npm run user:add -- staff@example.com "Staff Name" → prints a one-time password. */
async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  if (!email?.includes("@")) throw new Error('Usage: npm run user:add -- email "Display Name"');
  const displayName = nameParts.join(" ") || email;
  const password = randomBytes(9).toString("base64url");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  await prisma.user.upsert({
    where: { email },
    create: { email, displayName, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
    update: { displayName, status: "ACTIVE", passwordHash: await bcrypt.hash(password, 12) },
  });
  await prisma.$disconnect();
  console.log(`Login: ${email}\nPassword: ${password}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

Check `prisma/seed.ts` for how it constructs the client and match it if it differs.

- [ ] **Step 2: Script.** In `package.json` `scripts` add `"user:add": "tsx prisma/add-user.ts"`.

- [ ] **Step 3: Checks**

Run: `npm run typecheck && npx eslint src prisma --max-warnings=0 && npm run user:add` (no args)
Expected: typecheck/eslint PASS; the no-args run prints the usage error and exits 1.

- [ ] **Step 4: Commit**

```bash
git add prisma/add-user.ts package.json
git commit -m "feat: npm run user:add creates a staff login"
```

---

### Task 9: Cutover (with the owner, not autonomous)

Every step here touches live accounts; do each only with the owner's go-ahead.

- [ ] **Step 1:** Owner rotates the WhatsApp system-user token and resets the app secret (both were pasted in chat earlier) and sets on Railway: `WHATSAPP_PROVIDER=meta`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID=1246736668534005`, `WHATSAPP_BUSINESS_ACCOUNT_ID=4528772400695826`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (new random), `AUTOMATION_TICK_SECRET` (new random).
- [ ] **Step 2:** Push/deploy; confirm the Railway deploy log shows the `20260926000000_message_retry_due_at` migration applied and the app boots.
- [ ] **Step 3:** Owner runs `npm run user:add` against production `DATABASE_URL` for each staff member and hands out the passwords.
- [ ] **Step 4:** Meta → WhatsApp → Configuration: callback `https://<railway-url>/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribed field `messages`. Meta's verify must succeed.
- [ ] **Step 5:** Unpublish n8n workflow `6xqH57hG47mGC1Om`. Create an n8n workflow "3pre tick": Schedule trigger every 15 min → HTTP POST `https://<railway-url>/api/automation/tick` with header `Authorization: Bearer <AUTOMATION_TICK_SECRET>`. Publish it.
- [ ] **Step 6:** Send from `/send` to the owner's number → message arrives; tap BRAND → thank-you arrives; `/leads` shows the lead; send to a known-failing number → it appears on `/failed` with a Hindi reason.
- [ ] **Step 7:** Record in memory that cutover is done.
