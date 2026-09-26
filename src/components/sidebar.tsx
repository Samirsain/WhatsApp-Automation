"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import type { NavIcon, NavItem } from "@/lib/nav";

/**
 * Stroke icons on a 24px grid, one weight. They are wayfinding, not decoration,
 * so the label always stays next to them.
 */
const ICONS: Record<NavIcon, React.ReactNode> = {
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />,
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
  leads: <path d="M20 6 9 17l-5-5" />,
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
        active ? "var(--color-action-primary)" : "var(--color-text-secondary)"
      }
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {ICONS[name]}
    </svg>
  );
}

export type NavCounts = Partial<Record<string, number>>;

/** Phones: the same screens as a bottom tab bar, like a messaging app. */
export function MobileNav({ items, counts }: { items: NavItem[]; counts: NavCounts }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const count = counts[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100",
              active ? "font-semibold text-[color:var(--color-action-primary)]" : "text-[color:var(--color-text-secondary)]",
            )}
          >
            <Icon name={item.icon} active={active} />
            <span>{item.label}</span>
            {count !== undefined && count > 0 && (
              <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-[color:var(--color-action-primary)] px-1.5 text-[10px] leading-4 font-semibold text-white tabular-nums">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
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
      className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-3 md:flex print:hidden"
    >
      <div className="flex items-center gap-2.5 px-2 py-1">
        <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" priority />
        <span className="font-semibold tracking-tight">3% Club</span>
      </div>

      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const count = counts[item.href];

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2.5 rounded-[var(--radius-sm)] py-1.5 pr-2 pl-2.5 transition-colors",
                  active
                    ? "bg-[color:var(--color-surface-muted)] font-semibold shadow-[inset_2px_0_0_var(--color-action-primary)]"
                    : "hover:bg-[color:var(--color-surface-muted)]",
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

      {footer && <div className="mt-auto">{footer}</div>}
    </nav>
  );
}
