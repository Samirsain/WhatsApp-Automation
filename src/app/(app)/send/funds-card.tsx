import { buttonClass, ErrorNote, inputClass } from "@/components/ui";
import type { FundsSnapshot } from "@/lib/brand/funds-server";
import { addTopup, undoLastTopup } from "./funds-actions";

const inr = (n: number) => `₹${n.toFixed(2)}`;

export function FundsCard({ funds }: { funds: FundsSnapshot }) {
  return (
    <section className="mb-4 flex max-w-2xl flex-col gap-2">
      {funds.outOfFunds && (
        <ErrorNote>
          Out of WhatsApp funds: Meta rejected a message for payment (131042). Add funds in Meta
          Billing, then record the top-up below.
        </ErrorNote>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] px-3 py-2.5">
        <div className="leading-tight">
          <div className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
            WhatsApp funds (estimate)
          </div>
          {!funds.hasTopups ? (
            <div className="font-semibold">Record your first top-up to see the balance</div>
          ) : funds.left === null ? (
            <div className="font-semibold">
              Added {inr(funds.added)} · spend not available from Meta right now
            </div>
          ) : (
            <>
              <div className="text-[length:var(--text-h2)] font-semibold tabular-nums">
                ~{inr(funds.left)} left{" "}
                <span className="text-[length:var(--text-small)] font-normal text-[color:var(--color-text-secondary)]">
                  ≈ {funds.messagesLeft} messages
                </span>
              </div>
              <div className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)] tabular-nums">
                Added {inr(funds.added)} · Spent {inr(funds.spent ?? 0)} · ~{inr(funds.perMessage)} per
                message · Meta updates spend a few hours late
              </div>
            </>
          )}
        </div>
        <form action={addTopup} className="flex items-center gap-2">
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="₹ amount"
            aria-label="Top-up amount in rupees"
            className={`${inputClass} w-28`}
          />
          <button type="submit" className={buttonClass.secondary}>
            + Add top-up
          </button>
        </form>
        {funds.lastTopup !== null && (
          <form action={undoLastTopup}>
            <button
              type="submit"
              className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)] underline"
            >
              Undo last top-up ({inr(funds.lastTopup)})
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
