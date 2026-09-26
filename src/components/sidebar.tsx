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
      className="sticky top-0 flex h-screen w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-3"
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
