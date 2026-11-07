"use client";

import { useState, useTransition } from "react";
import { buttonClass, cx } from "@/components/ui";
import { markInterested, markNotInterested } from "./actions";

type Choice = "no" | "yes";

const TINT: Record<Choice, string> = {
  no: "color-mix(in oklch, var(--color-status-error) 16%, transparent)",
  yes: "color-mix(in oklch, var(--color-status-success) 18%, transparent)",
};

// Pressed buttons sink a pixel and lose their shadow, so a tap is felt.
const PRESS = "shadow-[0_2px_0_rgb(0_0_0/0.18)] active:translate-y-0.5 active:shadow-none disabled:shadow-none";
const RED = cx(buttonClass.danger, PRESS);
const GREEN = cx(
  buttonClass.primary,
  PRESS,
  "bg-[color:var(--color-status-success)] hover:bg-[color:var(--color-status-success)] hover:opacity-90",
);

function Spinner() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Red "Not interested": the row flashes red and slides out, then the number
 * moves to Not Interested. Green "Interested": the row turns green and the chat opens.
 * The animation runs before the server call, so the row is already gone when
 * the list refreshes instead of vanishing mid-click.
 */
export function DecideButtons({ customerId, className }: { customerId: string; className?: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [, start] = useTransition();

  async function decide(next: Choice, button: HTMLElement) {
    setChoice(next);
    const row = button.closest<HTMLElement>("[data-funnel-row]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (row) {
      await row.animate([{ backgroundColor: TINT[next] }], { duration: 160, fill: "forwards", easing: "ease-out" }).finished;
      if (next === "no") {
        await row.animate(
          reduce
            ? [{ opacity: 1 }, { opacity: 0 }]
            : [
                { opacity: 1, transform: "translateX(0)" },
                { opacity: 0, transform: "translateX(-48px)" },
              ],
          { duration: reduce ? 150 : 320, delay: 120, fill: "forwards", easing: "cubic-bezier(0.4, 0, 1, 1)" },
        ).finished;
      }
    }

    start(async () => {
      try {
        await (next === "no" ? markNotInterested(customerId) : markInterested(customerId));
      } catch (error) {
        // A redirect (Interested opening the chat) is not a failure.
        if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw error;
        row?.getAnimations().forEach((a) => a.cancel());
        setChoice(null);
        alert("Could not save. Check your connection and try again.");
      }
    });
  }

  return (
    <div className={cx("flex gap-2", className)}>
      <button
        type="button"
        disabled={choice !== null}
        onClick={(e) => decide("no", e.currentTarget)}
        className={cx(RED, choice === "no" && "disabled:opacity-100", choice === "yes" && "opacity-40")}
      >
        {choice === "no" ? (
          <>
            <Spinner /> Moving…
          </>
        ) : (
          "Not interested"
        )}
      </button>
      <button
        type="button"
        disabled={choice !== null}
        onClick={(e) => decide("yes", e.currentTarget)}
        className={cx(GREEN, choice === "yes" && "disabled:opacity-100", choice === "no" && "opacity-40")}
      >
        {choice === "yes" ? (
          <>
            <Spinner /> Opening chat…
          </>
        ) : (
          "Interested"
        )}
      </button>
    </div>
  );
}
