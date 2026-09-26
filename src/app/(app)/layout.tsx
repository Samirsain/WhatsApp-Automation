import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui";
import { NAV } from "@/lib/nav";
import { prisma } from "@/lib/prisma";
import { can, ROLE_LABELS } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // Nav visibility is usability only; every page re-checks server-side.
  const items = NAV.filter((item) => can(user.roles, item.permission));

  const [unread, leads] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.customer.count({ where: { status: "QUALIFIED" } }),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={items}
        counts={{ "/leads": leads }}
        footer={
          <div className="flex flex-col gap-1 border-t border-[color:var(--color-border-default)] pt-2">
            <Link
              href="/notifications"
              className="flex items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 hover:bg-[color:var(--color-surface-muted)]"
            >
              Notifications
              {unread > 0 && <Badge tone="info">{unread}</Badge>}
            </Link>
            <div className="flex items-center gap-2 px-2 py-1">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-muted)] text-[length:var(--text-small)] font-semibold"
              >
                {initials(user.name, user.email)}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[length:var(--text-small)] font-semibold">
                  {user.name || user.email}
                </div>
                <div className="truncate text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                  {user.roles.map((r) => ROLE_LABELS[r]).join(", ") || "No role"}
                </div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-[var(--radius-sm)] px-1.5 py-1 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text-primary)]"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        }
      />
      <main className="min-w-0 flex-1 px-5 py-4">{children}</main>
    </div>
  );
}
