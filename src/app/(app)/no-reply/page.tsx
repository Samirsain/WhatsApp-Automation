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
const RED_BG = "bg-[color:var(--color-status-error)]/10";

/** Status badge: red once the whole funnel went unanswered. */
function Seen({ status, customer }: { status: string; customer: { status: string } }) {
  if (customer.status === "NO_RESPONSE") return <Badge tone="error">No response</Badge>;
  return <Badge tone={SEEN[status].tone}>{SEEN[status].label}</Badge>;
}

const step = (payload: unknown) => (payload as { step?: number } | null)?.step ?? 1;

/** A number is listed while its latest brand message went through but they never tapped Brand. */
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
      payload: true,
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
        description="The message reached these numbers, but they have not tapped Brand yet. Red = no reply after all 3 funnel messages."
      />
      {rows.length === 0 ? (
        <Card flush>
          <EmptyState title="No one is waiting" description="People who got the message but did not tap Brand show up here." />
        </Card>
      ) : (
        <>
          {/* Phones and tablets: one card per number. */}
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {rows.map((m) => (
              <li
                key={m.id}
                className={`rounded-[var(--radius-md)] border p-3 ${m.customer.status === "NO_RESPONSE" ? `border-[color:var(--color-status-error)] ${RED_BG}` : "border-[color:var(--color-border-default)] bg-[color:var(--color-surface)]"} shadow-[var(--shadow-surface)]`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{m.customer.name ?? "—"}</span>
                  <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                    {formatDateTime(m.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="tabular-nums text-[color:var(--color-text-secondary)]">{m.customer.phoneE164}</span>
                  <span className="flex shrink-0 gap-1">
                    <Badge>Funnel {step(m.payload)}</Badge>
                    <Seen status={m.deliveryStatus} customer={m.customer} />
                  </span>
                </div>
                <ContactButtons phone={m.customer.phoneE164} className="mt-2 grid grid-cols-2" />
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Card flush>
              <Table head={["Name", "Number", "Sent at", "Funnel", "Status", "Contact"]} caption="Got the message, no Brand tap">
                {rows.map((m) => (
                  <Row key={m.id} className={m.customer.status === "NO_RESPONSE" ? RED_BG : undefined}>
                    <Cell>{m.customer.name ?? "—"}</Cell>
                    <Cell className="whitespace-nowrap tabular-nums">{m.customer.phoneE164}</Cell>
                    <Cell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</Cell>
                    <Cell>{step(m.payload)} of 3</Cell>
                    <Cell>
                      <Seen status={m.deliveryStatus} customer={m.customer} />
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
