import { matchRange } from "@/lib/funnel-list";

/** The value with the searched part marked, so you see why a row matched. */
export function Highlight({ text, query, kind = "name" }: { text: string; query: string; kind?: "name" | "number" }) {
  const range = matchRange(text, query, kind);
  if (!range) return <>{text}</>;
  const [a, b] = range;
  return (
    <>
      {text.slice(0, a)}
      <mark className="rounded-[2px] bg-[color:var(--color-action-soft)] text-[color:var(--color-action-primary-hover)]">{text.slice(a, b)}</mark>
      {text.slice(b)}
    </>
  );
}
