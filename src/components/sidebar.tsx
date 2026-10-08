"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { cx, Wordmark } from "@/components/ui";
import type { NavIcon, NavItem } from "@/lib/nav";

/**
 * Stroke icons on a 24px grid, one weight. They are wayfinding, not decoration,
 * so the label always stays next to them.
 */
const ICONS: Record<NavIcon, React.ReactNode> = {
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  message: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  failed: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  noReply: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  brand: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  leads: <path d="M20 6 9 17l-5-5" />,
  media: <path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
};

function Icon({ name, active }: { name: NavIcon; active: boolean }) {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={
        active ? "var(--color-action-primary)" : "var(--color-text-primary)"
      }
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {ICONS[name]}
    </svg>
  );
}

export type NavCounts = Partial<Record<string, number>>;

/**
 * Phones: a hamburger that opens the full sidebar as a drawer. Native <dialog>
 * gives focus trap, Esc and backdrop for free.
 */
export function MobileNav({
  items,
  counts,
  footer,
}: {
  items: NavItem[];
  counts: NavCounts;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  const current = items.find((item) => pathname.startsWith(item.href));

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => ref.current?.showModal()}
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] transition-transform active:scale-95 motion-reduce:active:scale-100"
      >
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <span className="min-w-0 flex-1 truncate font-semibold tracking-tight">{current?.label ?? "3% Club"}</span>

      <dialog
        ref={ref}
        aria-label="Menu"
        // Tap on the backdrop (the dialog box itself, outside the panel) closes it.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none bg-transparent p-0 text-[color:var(--color-text-primary)] backdrop:bg-black/40 md:hidden"
      >
        <nav
          aria-label="Main"
          className="flex h-full flex-col gap-4 overflow-y-auto bg-[color:var(--color-surface)] p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center gap-2.5 px-2">
            <Image src="/logo.png" alt="" width={36} height={36} className="rounded-full" />
            <Wordmark className="flex-1 text-[14px]" />
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-text-secondary)] active:scale-95"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              const count = counts[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] pr-2 pl-3 text-[16px] font-medium transition-colors",
                      active
                        ? "bg-[color:var(--color-action-soft)] font-semibold text-[color:var(--color-action-primary-hover)] shadow-[inset_3px_0_0_var(--color-action-primary)]"
                        : "text-[color:var(--color-text-primary)] active:bg-[color:var(--color-surface-muted)]",
                    )}
                  >
                    <Icon name={item.icon} active={active} />
                    <span>{item.label}</span>
                    {count !== undefined && (
                      <span className="ml-auto rounded-full border border-[color:var(--color-border-default)] px-1.5 text-[length:var(--text-small)] font-semibold tabular-nums text-[color:var(--color-text-secondary)]">
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Links in the footer (Notifications) also close the drawer. */}
          {footer && (
            <div className="mt-auto" onClick={(e) => (e.target as HTMLElement).closest("a") && close()}>
              {footer}
            </div>
          )}
        </nav>
      </dialog>
    </>
  );
}

export function Sidebar({
  items,
  counts,
  footer,
}: {
  items: NavItem[];
  /** Keyed by href, so a screen's weight is visible before opening it. */
  counts: NavCounts;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-4 md:flex print:hidden"
    >
      <Link href="/" className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-1">
        <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full" priority />
        <Wordmark className="text-[15px]" />
      </Link>

      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const count = counts[item.href];

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-10 items-center gap-3 rounded-[var(--radius-md)] pr-2 pl-3 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-[color:var(--color-action-soft)] font-semibold text-[color:var(--color-action-primary-hover)] shadow-[inset_3px_0_0_var(--color-action-primary)]"
                    : "text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-muted)]",
                )}
              >
                <Icon name={item.icon} active={active} />
                <span>{item.label}</span>
                {count !== undefined && (
                  <span
                    className={cx(
                      "ml-auto rounded-full px-2 text-[length:var(--text-small)] leading-5 font-semibold tabular-nums",
                      count > 0
                        ? "bg-[color:var(--color-action-primary)] text-white"
                        : "border border-[color:var(--color-border-default)] text-[color:var(--color-text-secondary)]",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {footer && <div className="mt-auto">{footer}</div>}
    </nav>
  );
}
