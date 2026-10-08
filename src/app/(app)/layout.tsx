import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { MobileNav, Sidebar } from "@/components/sidebar";
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

  const [unread, finalLeads, brandLeads, recent] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.customer.count({ where: { status: "QUALIFIED" } }),
    prisma.customer.count({ where: { qualifiedAt: { not: null }, status: { not: "QUALIFIED" } } }),
    // Same rows and rule as the Not Delivered and No Reply pages: each number's latest brand message.
    prisma.message.findMany({
      where: { direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand" } },
      orderBy: { createdAt: "desc" },
      take: 2000, // ponytail: newest 2000 sends, as on those pages
      select: { customerId: true, deliveryStatus: true, customer: { select: { qualifiedAt: true } } },
    }),
  ]);
  const latest = new Map<string, (typeof recent)[number]>();
  for (const m of recent) if (!latest.has(m.customerId)) latest.set(m.customerId, m);
  let notDelivered = 0;
  let noReply = 0;
  for (const m of latest.values()) {
    if (m.deliveryStatus === "FAILED") notDelivered++;
    else if (m.deliveryStatus !== "QUEUED" && m.customer.qualifiedAt === null) noReply++;
  }

  const counts = { "/failed": notDelivered, "/no-reply": noReply, "/brand-leads": brandLeads, "/leads": finalLeads };

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const footer = (
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
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-[var(--radius-sm)] px-1.5 py-1 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text-primary)]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} counts={counts} footer={footer} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones: a slim header with a hamburger; the drawer holds the full sidebar. */}
        <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] px-4 py-1 md:hidden print:hidden">
          <MobileNav items={items} counts={counts} footer={footer} />
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" priority />
        </header>
        <main className="min-w-0 flex-1 px-4 py-4 md:px-8 md:py-6">{children}</main>
      </div>
    </div>
  );
}
