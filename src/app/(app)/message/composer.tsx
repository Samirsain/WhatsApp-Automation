"use client";

import { useActionState, useRef, useState } from "react";
import { getUploadTicket, sendDirect, type DirectState } from "./actions";

const MB = 1024 * 1024;
type MediaType = "image" | "video" | "audio" | "document";

/** WhatsApp's accepted formats and size caps; anything else goes as a document. */
function mediaTypeOf(file: File): MediaType {
  if (["image/jpeg", "image/png"].includes(file.type)) return "image";
  if (["video/mp4", "video/3gpp"].includes(file.type)) return "video";
  if (["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"].includes(file.type)) return "audio";
  return "document";
}
const MAX_BYTES: Record<MediaType, number> = {
  image: 5 * MB,
  video: 16 * MB,
  audio: 16 * MB,
  document: 10 * MB, // Cloudinary free plan caps raw files at 10 MB
};
const ICON: Record<MediaType, string> = { image: "🖼️", video: "🎬", audio: "🎵", document: "📄" };

/** Upload straight to Cloudinary; the server only signs the request. */
async function upload(file: File): Promise<{ link: string } | { error: string }> {
  const ticket = await getUploadTicket();
  if (!ticket) return { error: "File upload is not set up: add CLOUDINARY_API_SECRET." };
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", ticket.apiKey);
  body.set("timestamp", ticket.timestamp);
  body.set("signature", ticket.signature);
  body.set("folder", ticket.folder);
  try {
    const res = await fetch(ticket.url, { method: "POST", body });
    const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (json.secure_url) return { link: json.secure_url };
    if (json.error?.message?.startsWith("Invalid Signature")) {
      // The key is public; showing it tells whoever deploys which server variable is wrong.
      return {
        error: `Cloudinary rejected this server's keys (API key ${ticket.apiKey}). Fix CLOUDINARY_URL or CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET where the app runs, then redeploy.`,
      };
    }
    return { error: `Upload failed: ${json.error?.message ?? res.status}` };
  } catch {
    return { error: "Upload failed. Check your connection and try again." };
  }
}

export function Composer({ customerId }: { customerId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<DirectState, FormData>(async (prev) => {
    const send = (fields: Record<string, string>) => {
      const fd = new FormData();
      fd.set("customerId", customerId);
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      return sendDirect(prev, fd);
    };

    let result: DirectState;
    if (file) {
      const type = mediaTypeOf(file);
      if (file.size > MAX_BYTES[type]) {
        return { error: `${file.name} is too big. WhatsApp allows up to ${MAX_BYTES[type] / MB} MB for this kind of file.` };
      }
      const up = await upload(file);
      if ("error" in up) return up;
      // Audio carries no caption on WhatsApp, so the text follows as its own message.
      result = await send({ type, link: up.link, text: type === "audio" ? "" : text, filename: file.name });
      if (!result.error && type === "audio" && text.trim()) result = await send({ type: "text", text });
    } else {
      if (!text.trim()) return {};
      result = await send({ type: "text", text });
    }
    if (!result.error) {
      setFile(null);
      setText("");
    }
    return result;
  }, {});

  const canSend = !pending && (file !== null || text.trim() !== "");

  return (
    <form ref={formRef} action={action} className="shrink-0 border-t border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-2">
      {state.error && (
        <p role="alert" className="mb-2 rounded-[var(--radius-md)] bg-[color:var(--color-status-error)]/10 px-3 py-1.5 text-[color:var(--color-status-error)]">
          {state.error}
        </p>
      )}
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--color-surface-muted)] px-3 py-2">
          <span aria-hidden>{ICON[mediaTypeOf(file)]}</span>
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
            {(file.size / MB).toFixed(1)} MB
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remove attachment"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-[color:var(--color-text-secondary)] hover:bg-black/5"
          >
            ×
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Attach photo, video, audio or document"
          title="Attach"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]"
        >
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />
          </svg>
        </button>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            e.target.value = ""; // picking the same file again still fires
          }}
        />
        <textarea
          aria-label={file ? "Caption" : "Message"}
          placeholder={file ? "Add a caption…" : "Type a message"}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter is a new line — as in WhatsApp Web.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) formRef.current?.requestSubmit();
            }
          }}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-none text-base md:text-[length:var(--text-body)] rounded-[var(--radius-lg)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] px-3.5 py-2.5 [field-sizing:content] focus:outline-2 focus:outline-[color:var(--color-focus)]"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={pending ? "Sending" : "Send"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-status-success)] text-white transition-opacity disabled:opacity-40"
        >
          {pending ? (
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10.2 15 12 3.4 13.8z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
