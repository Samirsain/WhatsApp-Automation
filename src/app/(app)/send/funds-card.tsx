import { buttonClass, cx, inputClass } from "@/components/ui";
import type { FundsSnapshot } from "@/lib/brand/funds-server";
import { formatDateTime } from "@/lib/format";
import { updateBalance } from "./funds-actions";

const inr = (n: number) => `₹${n.toFixed(2)}`;
const META_BILLING = "https://business.facebook.com/billing_hub/accounts";

export function FundsCard({ funds }: { funds: FundsSnapshot }) {
  const red = funds.status === "out" || funds.low;
  return (
    <section
      className={cx(
        "mb-4 flex max-w-2xl flex-col gap-1.5 rounded-[var(--radius-md)] border px-3 py-2.5",
        red
          ? "border-[color:var(--color-status-error)] bg-[color:var(--color-status-error)]/10"
          : "border-[color:var(--color-border-default)] bg-[color:var(--color-surface)]",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
            WhatsApp funds
          </div>
          {funds.status === "out" ? (
            <div className="text-[length:var(--text-h2)] font-semibold text-[color:var(--color-status-error)]">
              Out of funds – messages are failing
            </div>
          ) : funds.left !== null ? (
            <div
              className={cx(
                "text-[length:var(--text-h2)] font-semibold tabular-nums",
                funds.low && "text-[color:var(--color-status-error)]",
              )}
            >
              ~{inr(funds.left)} left{" "}
              <span className="text-[length:var(--text-small)] font-normal text-[color:var(--color-text-secondary)]">
                ≈ {funds.messagesLeft} messages{funds.low ? " · below ₹50, add funds" : ""}
              </span>
            </div>
          ) : (
            <div className="font-semibold">
              {funds.balance ? "Balance not available from Meta right now" : "Set the balance from Meta Billing below"}
            </div>
          )}
        </div>
        <a href={META_BILLING} target="_blank" rel="noreferrer" className={buttonClass.secondary}>
          Add funds in Meta ↗
        </a>
      </div>

      <div className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)] tabular-nums">
        {funds.spentThisMonth !== null && <>Spent this month {inr(funds.spentThisMonth)} · </>}
        {funds.balance && <>Meta balance {inr(funds.balance.amount)} set {formatDateTime(new Date(funds.balance.at))} · </>}
        Meta reports spend a few hours late
      </div>

      <details className="text-[length:var(--text-small)]">
        <summary className="cursor-pointer text-[color:var(--color-text-secondary)] underline">
          Update balance
        </summary>
        <form action={updateBalance} className="mt-2 flex items-center gap-2">
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="₹ as shown in Meta"
            aria-label="Balance shown in Meta Billing, in rupees"
            className={`${inputClass} w-44`}
          />
          <button type="submit" className={buttonClass.secondary}>
            Save
          </button>
        </form>
      </details>
    </section>
  );
}
