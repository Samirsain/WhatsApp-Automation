"use server";

import { revalidatePath } from "next/cache";
import { getTopups, TOPUPS_KEY } from "@/lib/brand/funds-server";
import { assertPermission } from "@/lib/session";
import { setSetting } from "@/lib/settings";

export async function addTopup(formData: FormData): Promise<void> {
  const user = await assertPermission("batch:manage");
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return;
  const topups = await getTopups();
  await setSetting(TOPUPS_KEY, [...topups, { amount: Math.round(amount * 100) / 100, at: new Date().toISOString() }], user.id);
  revalidatePath("/send");
}

/** A mistyped top-up would inflate the balance, so the latest one can be taken back. */
export async function undoLastTopup(): Promise<void> {
  const user = await assertPermission("batch:manage");
  const topups = await getTopups();
  if (topups.length === 0) return;
  await setSetting(TOPUPS_KEY, topups.slice(0, -1), user.id);
  revalidatePath("/send");
}
