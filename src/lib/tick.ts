import "server-only";
import { tick } from "@/lib/automation/worker";
import { dispatchRunningBatches } from "@/lib/batches/runner";
import { sendDueFollowUps } from "@/lib/brand/funnel";
import { sendDueRetries } from "@/lib/brand/retry";
import { archiveInboundMedia } from "@/lib/whatsapp/archive";

/** One pass of every timed job. Safe to overlap: each job claims its rows. */
export async function runTick() {
  const automations = await tick();
  const batches = await dispatchRunningBatches();
  const retries = await sendDueRetries();
  const funnel = await sendDueFollowUps();
  const archived = await archiveInboundMedia();
  return { automations, batches, retries, funnel, archived };
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
        if (r.funnel.sent || r.funnel.red) console.info("[tick] funnel", r.funnel);
      })
      .catch((err) => console.error("[tick] failed", err instanceof Error ? err.message : err));
  setTimeout(run, 60_000); // first pass shortly after boot, to catch up after a deploy
  setInterval(run, EVERY_MS);
}
