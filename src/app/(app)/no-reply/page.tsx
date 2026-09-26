import { ContactButtons } from "@/components/contact-buttons";
import { Badge, Card, Cell, EmptyState, PageHeader, Row, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const SEEN: Record<string, { label: string; tone: "success" | "info" | "neutral" }> = {
  READ: { label: "Seen", tone: "success" },
  DELIVERED: { label: "Delivered", tone: "info" },
  SENT: { label: "Sent", tone: "neutral" },
};

/** A number is listed while its latest brand message went through but they never tapped BRAND. */
export default async function NoReplyPage() {
  await requirePermission("batch:read");

  const recent = await prisma.message.findMany({
    where: { direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand" } },
    orderBy: { createdAt: "desc" },
    take: 2000, // ponytail: newest 2000 sends; paginate if the list outgrows it
    select: {
      id: true,
      customerId: true,
      deliveryStatus: true,
      createdAt: true,
      customer: { select: { name: true, phoneE164: true, status: true } },
    },
  });
  const seen = new Set<string>();
  const rows = recent.filter((m) => {
    if (seen.has(m.customerId)) return false;
    seen.add(m.customerId);
    return m.deliveryStatus in SEEN && m.customer.status !== "QUALIFIED";
  });

  return (
    <>
      <PageHeader
        title="No reply"
        description="The message reached these numbers, but they have not tapped BRAND yet."
      />
      {rows.length === 0 ? (
        <Card flush>
          <EmptyState title="No one is waiting" description="People who got the message but did not tap BRAND show up here." />
        </Card>
      ) : (
        <>
          {/* Phones and tablets: one card per number. */}
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {rows.map((m) => (
              <li
                key={m.id}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-3 shadow-[var(--shadow-surface)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{m.customer.name ?? "—"}</span>
                  <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                    {formatDateTime(m.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="tabular-nums text-[color:var(--color-text-secondary)]">{m.customer.phoneE164}</span>
                  <Badge tone={SEEN[m.deliveryStatus].tone}>{SEEN[m.deliveryStatus].label}</Badge>
                </div>
                <ContactButtons phone={m.customer.phoneE164} className="mt-2 grid grid-cols-2" />
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Card flush>
              <Table head={["Name", "Number", "Sent at", "Status", "Contact"]} caption="Got the message, no BRAND tap">
                {rows.map((m) => (
                  <Row key={m.id}>
                    <Cell>{m.customer.name ?? "—"}</Cell>
                    <Cell className="whitespace-nowrap tabular-nums">{m.customer.phoneE164}</Cell>
                    <Cell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</Cell>
                    <Cell>
                      <Badge tone={SEEN[m.deliveryStatus].tone}>{SEEN[m.deliveryStatus].label}</Badge>
                    </Cell>
                    <Cell>
                      <ContactButtons phone={m.customer.phoneE164} className="flex" />
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
