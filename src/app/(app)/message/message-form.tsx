"use client";

import { useActionState, useState } from "react";
import { buttonClass, cx, ErrorNote, inputClass } from "@/components/ui";
import { relativeTime } from "@/lib/relative-time";
import { sendDirect, type DirectState } from "./actions";

const TYPES = [
  ["text", "Text"],
  ["image", "Image"],
  ["video", "Video"],
  ["audio", "Audio"],
  ["document", "Document"],
] as const;

const WINDOW_MS = 24 * 60 * 60_000;

type Chat = { customerId: string; phoneE164: string; name: string | null; lastText: string | null; lastAt: string };

export function MessageForm({ chats }: { chats: Chat[] }) {
  const [type, setType] = useState<(typeof TYPES)[number][0]>("text");
  const [picked, setPicked] = useState(chats[0].customerId);
  const [state, action, pending] = useActionState<DirectState, FormData>(sendDirect, {});

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[length:var(--text-small)] font-medium">
          Open chats ({chats.length})
        </legend>
        {chats.map((c) => (
          <label
            key={c.customerId}
            className={cx(
              "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border px-2.5 py-2",
              picked === c.customerId
                ? "border-[color:var(--color-action-primary)] bg-[color:var(--color-surface-muted)]"
                : "border-[color:var(--color-border-default)] hover:bg-[color:var(--color-surface-muted)]",
            )}
          >
            <input
              type="radio"
              name="customerId"
              value={c.customerId}
              checked={picked === c.customerId}
              onChange={() => setPicked(c.customerId)}
              className="mt-1"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <b>{c.name || "No name"}</b>
                <span className="tabular-nums text-[color:var(--color-text-secondary)]">{c.phoneE164}</span>
              </span>
              {c.lastText && <span className="truncate">“{c.lastText}”</span>}
              <span
                suppressHydrationWarning
                className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]"
              >
                Wrote {relativeTime(new Date(c.lastAt))} · window closes{" "}
                {relativeTime(new Date(new Date(c.lastAt).getTime() + WINDOW_MS))}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-[length:var(--text-small)] font-medium">Type</span>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className={inputClass}
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {type !== "text" && (
        <label className="flex flex-col gap-1">
          <span className="text-[length:var(--text-small)] font-medium">File link (public https URL)</span>
          <input name="link" type="url" required placeholder="https://…" className={inputClass} />
        </label>
      )}

      {type !== "audio" && (
        <label className="flex flex-col gap-1">
          <span className="text-[length:var(--text-small)] font-medium">
            {type === "text" ? "Message" : "Caption (optional)"}
          </span>
          <textarea name="text" rows={4} required={type === "text"} className={inputClass} />
        </label>
      )}

      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {state.sentTo && !pending && (
        <p
          role="status"
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-border-default)] px-2.5 py-1.5"
        >
          Sent to <b>{state.sentTo}</b>.
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
