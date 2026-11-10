import { Card } from "@/components/ui";

const BAR = "rounded-[var(--radius-sm)] bg-[color:var(--color-surface-muted)]";

/** Shown the moment a link is tapped, while the page loads; the sidebar stays put. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className={`mb-4 h-7 w-40 ${BAR}`} />
      <div className={`mb-4 h-10 w-full ${BAR}`} />
      <Card flush>
        <div className="flex flex-col gap-3 p-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`h-6 ${BAR}`} />
          ))}
        </div>
      </Card>
    </div>
  );
}
