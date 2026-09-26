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
    return { error: "Enter at least one valid number.", rejected: parsed.rejected };
  }
  if (parsed.valid.length > MAX_ROWS) {
    return { error: `Send up to ${MAX_ROWS} numbers at a time.` };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  // ponytail: sequential inside the request; move to the tick worker if lists grow past a few hundred
  for (const row of parsed.valid) {
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
    metadata: { sent, failed, skipped, rejected: parsed.rejected.length },
  });
  revalidatePath("/failed");
  return { sent, failed, skipped, rejected: parsed.rejected };
}
