"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass, ErrorNote, inputClass } from "@/components/ui";
import { parseCsvRows, rowsToText } from "@/lib/brand/rules";
import { sendBulk, type SendState } from "./actions";

type RowInput = { name: string; number: string };
const blank = (n: number): RowInput[] => Array.from({ length: n }, () => ({ name: "", number: "" }));

export function SendForm() {
  const [rows, setRows] = useState<RowInput[]>(blank(5));
  const [csvNote, setCsvNote] = useState<string | null>(null);
  const [state, action, pending] = useActionState<SendState, FormData>(async (prev, formData) => {
    const result = await sendBulk(prev, formData);
    // Sent rows are cleared so the same list is not sent twice by accident.
    if (result.sent !== undefined) {
      setRows(blank(5));
      setCsvNote(null);
    }
    return result;
  }, {});
  const filled = rows.filter((r) => r.number.trim() !== "").length;

  function update(i: number, key: keyof RowInput, value: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }

  async function loadCsv(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const { rows: loaded, skipped } = parseCsvRows(await file.text());
    setRows(loaded.length > 0 ? loaded : blank(5));
    setCsvNote(`${loaded.length} rows loaded from ${file.name}${skipped ? `, ${skipped} skipped (no phone number)` : ""}.`);
    input.value = ""; // so picking the same file again still loads it
  }

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-3">
      <input type="hidden" name="rows" value={rowsToText(rows)} />
      <div className="grid grid-cols-[1fr_1fr] gap-2 text-[length:var(--text-small)] font-medium">
        <span>Name</span>
        <span>Number</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr] gap-2">
          <input
            aria-label={`Name ${i + 1}`}
            className={inputClass}
            placeholder={i === 0 ? "Rahul" : undefined}
            value={r.name}
            onChange={(e) => update(i, "name", e.target.value)}
          />
          <input
            aria-label={`Number ${i + 1}`}
            className={inputClass}
            placeholder={i === 0 ? "9876543210" : undefined}
            inputMode="tel"
            value={r.number}
            onChange={(e) => update(i, "number", e.target.value)}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass.secondary}
          onClick={() => setRows((rs) => [...rs, ...blank(1)])}
        >
          + Add row
        </button>
        <label className={buttonClass.secondary}>
          CSV upload
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => loadCsv(e.target)}
          />
        </label>
      </div>
      {csvNote && (
        <p role="status" className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
          {csvNote}
        </p>
      )}

      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {state.rejected && state.rejected.length > 0 && (
        <ErrorNote>
          Not sent, these are not valid 10-digit mobile numbers:{" "}
          {state.rejected.map((r) => r.raw.split(",").at(-1)?.trim()).join(" · ")}
        </ErrorNote>
      )}
      {state.sent !== undefined && (
        <p
          role="status"
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-border-default)] px-2.5 py-1.5"
        >
          Sent: <b>{state.sent}</b> · Failed: <b>{state.failed}</b> · Skipped (opted out / already BRAND lead):{" "}
          <b>{state.skipped}</b>
          {" — "}
          <Link href="/failed" className="underline">
            See not delivered
          </Link>
        </p>
      )}

      <button type="submit" disabled={pending || filled === 0} className={buttonClass.primary}>
        {pending ? "Sending…" : `Send messages (${filled})`}
      </button>
    </form>
  );
}
