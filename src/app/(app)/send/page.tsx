import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/session";
import { SendForm } from "./send-form";

export const dynamic = "force-dynamic";

/** The funnel's timing, counted from the day Broadcast sends Funnel 1. */
const FLOW = [
  { day: 0, text: "Funnel 1 goes out: one of the 3 messages, picked at random." },
  { day: 3, text: "No Brand tap yet: Funnel 2 goes out." },
  { day: 5, text: "Still no tap: Funnel 3 goes out." },
  { day: 7, text: "Still nothing: the number turns red on No Reply." },
];

export default async function SendPage() {
  await requirePermission("batch:manage");
  return (
    <>
      <PageHeader title="Broadcast" description="Enter a name and number for each lead." />
      {/* Desktop: the form leads, the timing sits beside it. Phones: timing below the form. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,42rem)_minmax(14rem,18rem)]">
        <SendForm />
        <aside aria-labelledby="flow-title" className="lg:sticky lg:top-6">
          <h2 id="flow-title" className="mb-3 text-[length:var(--text-h3)] font-semibold">
            What happens after you send
          </h2>
          <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-[color:var(--color-border-default)]">
            {FLOW.map((s, i) => (
              <li key={s.day} className="relative pl-6">
                <span
                  aria-hidden
                  className={`absolute top-1 left-0 h-[11px] w-[11px] rounded-full border-2 bg-[color:var(--color-canvas)] ${
                    i === FLOW.length - 1 ? "border-[color:var(--color-status-error)]" : "border-[color:var(--color-action-primary)]"
                  }`}
                />
                <div className="text-[length:var(--text-small)] font-semibold tabular-nums text-[color:var(--color-text-secondary)]">
                  Day {s.day}
                </div>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
