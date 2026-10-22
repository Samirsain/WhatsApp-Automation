"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { findAlreadyMessaged, type AlreadyMessaged } from "@/lib/brand/already-messaged";
import { sendBrandMessage } from "@/lib/brand/send";
import { parseNumberList } from "@/lib/numbers/parse-list";
import { parsePhone } from "@/lib/phone";
import { assertPermission } from "@/lib/session";

export type SendState = {
  error?: string;
  sent?: number;
  failed?: number;
  skipped?: number;
  /** Already messaged before, so not sent again. */
  alreadySent?: (AlreadyMessaged & { name: string | null })[];
  /** The same number typed twice in this list; sent once. */
  duplicates?: number;
  rejected?: { raw: string; reason: string }[];
};

const MAX_ROWS = 200;

/** For the form's live warning: which typed numbers were already messaged. */
export async function checkNumbers(numbers: string[]): Promise<AlreadyMessaged[]> {
  await assertPermission("batch:manage");
  const e164s = numbers
    .slice(0, MAX_ROWS)
    .map((n) => parsePhone(n))
    .flatMap((p) => (p.ok ? [p.e164] : []));
  return [...(await findAlreadyMessaged(e164s)).values()];
}

export async function sendBulk(_prev: SendState, formData: FormData): Promise<SendState> {
  const user = await assertPermission("batch:manage");
  const text = String(formData.get("rows") ?? "");
  const parsed = parseNumberList(text);
  if (parsed.valid.length === 0) {
    return { error: "Enter at least one valid number.", rejected: parsed.rejected };
  }
  if (parsed.valid.length > MAX_ROWS) {
    return { error: `Send up to ${MAX_ROWS} numbers at a time.` };
  }

  const already = await findAlreadyMessaged(parsed.valid.map((r) => r.e164));
  const alreadySent = parsed.valid.flatMap((r) => {
    const hit = already.get(r.e164);
    return hit ? [{ ...hit, name: r.name }] : [];
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  // ponytail: sequential inside the request; move to the tick worker if lists grow past a few hundred
  for (const row of parsed.valid) {
    if (already.has(row.e164)) continue;
    try {
      const r = await sendBrandMessage({ e164: row.e164, name: row.name });
      if (r.ok) sent++;
      else if (r.skipped) skipped++;
      else failed++;
    } catch (err) {
      // One bad row must not hide what happened to the rest of the list.
      console.error("[send] row failed", err instanceof Error ? err.message : err);
      failed++;
    }
  }

  await logActivity({
    actorUserId: user.id,
    eventType: "brand.bulk_sent",
    objectType: "send",
    metadata: {
      sent,
      failed,
      skipped,
      alreadySent: alreadySent.length,
      duplicates: parsed.duplicateCount,
      rejected: parsed.rejected.length,
    },
  });
  revalidatePath("/failed");
  return { sent, failed, skipped, alreadySent, duplicates: parsed.duplicateCount, rejected: parsed.rejected };
}
