"use client";

import { useTransition } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { LEAD_STAGES, STAGE_LABELS, type LeadStage } from "@/lib/brand/stages";
import { setLeadStage } from "./actions";

/** Saves on change; no separate save button. */
export function StageSelect({ id, stage }: { id: string; stage: LeadStage }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Lead status"
      defaultValue={stage}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        start(() => setLeadStage(id, value));
      }}
      className={`${inputClass} w-40 py-1 print:hidden`}
    >
      {LEAD_STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClass.secondary} print:hidden`}>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V3h12v6" />
        <rect x="3" y="9" width="18" height="8" rx="2" />
        <path d="M6 14h12v7H6z" />
      </svg>
      Print
    </button>
  );
}
