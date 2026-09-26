import "server-only";
import { tick } from "@/lib/automation/worker";
import { dispatchRunningBatches } from "@/lib/batches/runner";
import { sendDueRetries } from "@/lib/brand/retry";

/** One pass of every timed job. Safe to overlap: each job claims its rows. */
export async function runTick() {
  const automations = await tick();
  const batches = await dispatchRunningBatches();
  const retries = await sendDueRetries();
  return { automations, batches, retries };
}

const EVERY_MS = 15 * 60 * 1000;

/**
 * The app drives its own timers, so no outside scheduler is needed.
 * ponytail: one in-process interval; with several instances each ticks, which
 * is harmless because every job claims atomically.
 */
export function startTickLoop() {
  const run = () =>
    runTick()
      .then((r) => {
        if (r.retries.sent || r.retries.skipped) console.info("[tick] retries", r.retries);
      })
      .catch((err) => console.error("[tick] failed", err instanceof Error ? err.message : err));
  setTimeout(run, 60_000); // first pass shortly after boot, to catch up after a deploy
  setInterval(run, EVERY_MS);
}
