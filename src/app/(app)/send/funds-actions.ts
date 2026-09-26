"use server";

import { revalidatePath } from "next/cache";
import { BALANCE_KEY } from "@/lib/brand/funds-server";
import { assertPermission } from "@/lib/session";
import { setSetting } from "@/lib/settings";

/**
 * Record the balance Meta Billing shows right now. Meta deducts spend about
 * once a day, so the figure stands for the start of today; the panel then
 * subtracts the spend Meta reports from today on.
 */
export async function updateBalance(formData: FormData): Promise<void> {
  const user = await assertPermission("batch:manage");
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return;
  await setSetting(BALANCE_KEY, { amount: Math.round(amount * 100) / 100, at: new Date().toISOString() }, user.id);
  revalidatePath("/send");
}
