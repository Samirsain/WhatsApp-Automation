import Link from "next/link";
import { cx } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/relative-time";
import { requirePermission } from "@/lib/session";
import { chatMessages, openChats, WINDOW_MS } from "@/lib/whatsapp/window";
import { AutoRefresh } from "./auto-refresh";
import { Composer } from "./composer";

export const dynamic = "force-dynamic";

// The team reads times in India; the server clock may be UTC.
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

type Payload = {
  kind?: string;
  mediaType?: string;
  link?: string;
  mediaId?: string;
  filename?: string;
  image?: string;
  step?: number;
} | null;
type ChatMessage = Awaited<ReturnType<typeof chatMessages>>[number];

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] font-semibold text-[color:var(--color-text-secondary)]"
    >
      {(name.trim()[0] ?? "#").toUpperCase()}
    </span>
  );
}

function Ticks({ status }: { status: ChatMessage["deliveryStatus"] }) {
  if (status === "FAILED") return <span className="font-semibold text-[color:var(--color-status-error)]">Not delivered</span>;
  if (status === "QUEUED") return <span aria-label="Sending">🕓</span>;
  const label = { SENT: "Sent", DELIVERED: "Delivered", READ: "Read" }[status];
  return (
    <span
      aria-label={label}
      title={label}
      className={cx("tracking-[-0.2em]", status === "READ" && "text-[color:var(--color-tick-read)]")}
    >
      {status === "SENT" ? "✓" : "✓✓"}
    </span>
  );
}

function Body({ m }: { m: ChatMessage }) {
  const p = m.payload as Payload;
  // Ours live on Cloudinary; the customer's are proxied from WhatsApp.
  const src = p?.link ?? (p?.mediaId ? `/api/whatsapp-media/${p.mediaId}` : undefined);
  const media = src && p?.mediaType;
  return (
    <>
      {(media === "image" || media === "sticker") && (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote media, no fixed size */}
          <img
            src={src}
            alt={media === "sticker" ? "Sticker" : "Photo"}
            loading="lazy"
            className={cx("mb-1 rounded-[var(--radius-md)]", media === "sticker" ? "h-32 w-32" : "max-h-72")}
          />
        </a>
      )}
      {media === "video" && <video src={src} controls preload="metadata" className="mb-1 max-h-72 rounded-[var(--radius-md)]" />}
      {media === "audio" && <audio src={src} controls preload="metadata" className="mb-1 max-w-full" />}
      {media === "document" && (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="mb-1 flex items-center gap-2 rounded-[var(--radius-md)] bg-black/5 px-2.5 py-2 underline-offset-2 hover:underline"
        >
          📄 <span className="truncate">{p!.filename || "Document"}</span>
        </a>
      )}
      {m.type === "TEMPLATE" && (
        <>
          {p?.image && (
            // eslint-disable-next-line @next/next/no-img-element -- template header image
            <img src={p.image} alt="" className="mb-1 max-h-48 rounded-[var(--radius-md)]" />
          )}
          <span className="italic text-[color:var(--color-text-secondary)]">
            Funnel {p?.step ?? 1} message
          </span>
        </>
      )}
      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
      {/* Anything WhatsApp sends that we don't render (location, contact, older media rows). */}
      {m.direction === "INBOUND" && !m.body && !media && (
        <p className="italic text-[color:var(--color-text-secondary)]">Unsupported message — open WhatsApp to see it</p>
      )}
    </>
  );
}

export default async function MessagePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await requirePermission("batch:manage");
  const selectedId = (await searchParams).c;
  const chats = await openChats();
  const now = new Date();

  const open = chats.find((c) => c.customerId === selectedId);
  // A chat whose window closed can still be read, just not written to.
  const customer =
    open ??
    (selectedId && /^[0-9a-f-]{36}$/i.test(selectedId)
      ? await prisma.customer
          .findUnique({ where: { id: selectedId }, select: { id: true, name: true, phoneE164: true } })
          .then((c) => c && { customerId: c.id, name: c.name, phoneE164: c.phoneE164, lastAt: null })
      : null);
  const messages = customer ? await chatMessages(customer.customerId) : [];

  return (
    // Phones: pinned between the app's top bar (61px) and bottom tab bar (57px + safe area),
    // edge to edge like a messaging app. Desktop: a framed two-pane panel.
    <div className="grid grid-rows-[minmax(0,1fr)] overflow-hidden bg-[color:var(--color-surface)] max-md:fixed max-md:inset-x-0 max-md:top-[61px] max-md:bottom-[calc(57px+env(safe-area-inset-bottom))] max-md:z-10 md:h-[calc(100dvh-2rem)] md:min-h-[420px] md:grid-cols-[minmax(260px,340px)_1fr] md:rounded-[var(--radius-lg)] md:border md:border-[color:var(--color-border-default)]">
      <AutoRefresh />
      {/* Chat list. Phones show either the list or one chat. */}
      <aside
        className={cx(
          "flex min-h-0 flex-col border-[color:var(--color-border-default)] md:border-r",
          customer && "hidden md:flex",
        )}
      >
        <div className="border-b border-[color:var(--color-border-default)] px-4 py-3">
          <h1 className="text-[length:var(--text-h2)] font-semibold">Chats</h1>
          <p className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
            Wrote to you in the last 24 hours
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {chats.length === 0 && (
            <li className="px-4 py-8 text-center text-[color:var(--color-text-secondary)]">
              No open chats. A number shows up here as soon as it messages you.
            </li>
          )}
          {chats.map((c) => (
            <li key={c.customerId}>
              <Link
                href={`/message?c=${c.customerId}`}
                aria-current={c.customerId === customer?.customerId ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 border-b border-[color:var(--color-border-default)] px-4 py-2.5",
                  c.customerId === customer?.customerId
                    ? "bg-[color:var(--color-surface-muted)]"
                    : "hover:bg-[color:var(--color-surface-muted)]",
                )}
              >
                <Avatar name={c.name || c.phoneE164.slice(-1)} />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate">{c.name || c.phoneE164}</b>
                    <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                      {TIME.format(c.lastAt)}
                    </span>
                  </span>
                  {c.name && (
                    <span className="block text-[length:var(--text-small)] tabular-nums text-[color:var(--color-text-secondary)]">
                      {c.phoneE164}
                    </span>
                  )}
                  {c.lastText && <span className="block truncate">{c.lastText}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversation */}
      {customer ? (
        <section className="flex min-h-0 flex-col">
          <header className="flex items-center gap-2 border-b border-[color:var(--color-border-default)] px-2 py-2 md:gap-3 md:px-3">
            <Link
              href="/message"
              className="flex h-11 w-9 shrink-0 items-center justify-center text-xl md:hidden"
              aria-label="Back to chats"
            >
              ←
            </Link>
            <Avatar name={customer.name || customer.phoneE164.slice(-1)} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-semibold">{customer.name || customer.phoneE164}</div>
              <div className="truncate text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                {customer.name && <span className="tabular-nums">{customer.phoneE164}</span>}
                {customer.name && open && " · "}
                {open && `Open ${relativeTime(new Date(open.lastAt.getTime() + WINDOW_MS), now).replace(/^in /, "")} more`}
              </div>
            </div>
          </header>

          {/* column-reverse keeps the view pinned to the newest message without JS */}
          <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-[color:var(--color-chat-canvas)] px-3 py-3 md:px-8">
            <ol className="flex flex-col gap-1.5">
              {messages.map((m, i) => {
                const out = m.direction === "OUTBOUND";
                const day = DAY.format(m.createdAt);
                const newDay = i === 0 || DAY.format(messages[i - 1].createdAt) !== day;
                return (
                  <li key={m.id} className="flex flex-col">
                    {newDay && (
                      <span className="my-2 self-center rounded-[var(--radius-md)] bg-[color:var(--color-surface)] px-2.5 py-0.5 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)] shadow-[var(--shadow-surface)]">
                        {day}
                      </span>
                    )}
                    <div
                      className={cx(
                        "max-w-[85%] min-w-0 break-words rounded-[var(--radius-lg)] px-2.5 py-1.5 shadow-[var(--shadow-surface)] md:max-w-[65%] [&_audio]:w-64 [&_audio]:max-w-full [&_img]:max-w-full [&_video]:max-w-full",
                        out
                          ? "self-end rounded-tr-[var(--radius-sm)] bg-[color:var(--color-bubble-out)]"
                          : "self-start rounded-tl-[var(--radius-sm)] bg-[color:var(--color-surface)]",
                      )}
                    >
                      <Body m={m} />
                      <span className="float-right mt-0.5 ml-3 flex items-center gap-1 text-[11px] text-[color:var(--color-text-secondary)]">
                        {TIME.format(m.createdAt)}
                        {out && <Ticks status={m.deliveryStatus} />}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {open ? (
            <Composer customerId={customer.customerId} />
          ) : (
            <p className="border-t border-[color:var(--color-border-default)] px-4 py-3 text-center text-[color:var(--color-text-secondary)]">
              This chat is closed. WhatsApp only allows a reply within 24 hours of their last message.
            </p>
          )}
        </section>
      ) : (
        <section className="hidden flex-col items-center justify-center gap-1 bg-[color:var(--color-chat-canvas)] text-center md:flex">
          <p className="font-semibold">Pick a chat</p>
          <p className="max-w-xs text-[color:var(--color-text-secondary)]">
            Send text, photos, videos, audio or documents to anyone who wrote in the last 24 hours.
          </p>
        </section>
      )}
    </div>
  );
}
