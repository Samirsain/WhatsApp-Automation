"use client";

import { useActionState, useState } from "react";
import { buttonClass, cx, ErrorNote, inputClass } from "@/components/ui";
import { relativeTime } from "@/lib/relative-time";
import { getUploadTicket, sendDirect, type DirectState } from "./actions";

const TYPES = [
  ["text", "Text"],
  ["image", "Image"],
  ["video", "Video"],
  ["audio", "Audio"],
  ["document", "Document"],
] as const;

const WINDOW_MS = 24 * 60 * 60_000;
const MB = 1024 * 1024;

/** What WhatsApp accepts per type (Cloud API media limits). */
const MEDIA: Record<Exclude<(typeof TYPES)[number][0], "text">, { accept: string; maxBytes: number }> = {
  image: { accept: "image/jpeg,image/png", maxBytes: 5 * MB },
  video: { accept: "video/mp4,video/3gpp", maxBytes: 16 * MB },
  audio: { accept: "audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg", maxBytes: 16 * MB },
  document: { accept: "*/*", maxBytes: 10 * MB }, // Cloudinary free plan caps raw files at 10 MB
};

/** Upload the chosen file straight to Cloudinary and put its URL on the form as `link`. */
async function attachUpload(formData: FormData): Promise<string | null> {
  const file = formData.get("file");
  formData.delete("file");
  if (!(file instanceof File) || file.size === 0) return "Choose a file.";
  const limit = MEDIA[formData.get("type") as keyof typeof MEDIA].maxBytes;
  if (file.size > limit) return `File is too big. WhatsApp allows up to ${limit / MB} MB for this type.`;

  const ticket = await getUploadTicket();
  if (!ticket) return "File upload is not set up (CLOUDINARY_URL is missing).";
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", ticket.apiKey);
  body.set("timestamp", ticket.timestamp);
  body.set("signature", ticket.signature);
  body.set("folder", ticket.folder);
  try {
    const res = await fetch(ticket.url, { method: "POST", body });
    const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!json.secure_url) return `Upload failed: ${json.error?.message ?? res.status}`;
    formData.set("link", json.secure_url);
    return null;
  } catch {
    return "Upload failed. Check your connection and try again.";
  }
}

type Chat = { customerId: string; phoneE164: string; name: string | null; lastText: string | null; lastAt: string };

export function MessageForm({ chats }: { chats: Chat[] }) {
  const [type, setType] = useState<(typeof TYPES)[number][0]>("text");
  const [picked, setPicked] = useState(chats[0].customerId);
  const [state, action, pending] = useActionState<DirectState, FormData>(async (prev, formData) => {
    if (formData.get("type") !== "text") {
      const error = await attachUpload(formData);
      if (error) return { error };
    }
    return sendDirect(prev, formData);
  }, {});

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
          <span className="text-[length:var(--text-small)] font-medium">
            File (up to {MEDIA[type].maxBytes / MB} MB)
          </span>
          <input key={type} name="file" type="file" required accept={MEDIA[type].accept} className={inputClass} />
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
        {pending ? (type === "text" ? "Sending…" : "Uploading and sending…") : "Send"}
      </button>
    </form>
  );
}
