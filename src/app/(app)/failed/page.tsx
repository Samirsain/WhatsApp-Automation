import { Badge, Card, Cell, EmptyState, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { failureAction, failureReason } from "@/lib/brand/rules";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { resendBrand } from "./actions";

export const dynamic = "force-dynamic";

function Action({ id, action, full }: { id: string; action: "auto" | "resend" | "none"; full?: boolean }) {
  if (action === "auto") return <Badge tone="info">Retrying automatically in 24h</Badge>;
  if (action === "none") return null;
  return (
    <form action={resendBrand}>
      <input type="hidden" name="messageId" value={id} />
      <button type="submit" className={`${buttonClass.secondary}${full ? " w-full" : ""}`}>
        Resend
      </button>
    </form>
  );
}

/** A number is listed while its latest brand message is FAILED. */
export default async function FailedPage() {
  await requirePermission("batch:read");

  const recent = await prisma.message.findMany({
    where: { direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand" } },
    orderBy: { createdAt: "desc" },
    take: 2000, // ponytail: newest 2000 sends; paginate if the list outgrows it
    select: {
      id: true,
      customerId: true,
      deliveryStatus: true,
      failureCode: true,
      failedAt: true,
      createdAt: true,
      retryDueAt: true,
      customer: { select: { name: true, phoneE164: true } },
    },
  });
  const seen = new Set<string>();
  const failed = recent.filter((m) => {
    if (seen.has(m.customerId)) return false;
    seen.add(m.customerId);
    return m.deliveryStatus === "FAILED";
  });

  return (
    <>
      <PageHeader
        title="Not Delivered"
        description="Messages that did not reach these numbers, why, and what happens next."
      />
      {failed.length === 0 ? (
        <Card flush>
          <EmptyState title="Everything was delivered" description="Failed messages will show up here." />
        </Card>
      ) : (
        <>
          {/* Phones and tablets: one card per number. */}
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {failed.map((m) => (
              <li
                key={m.id}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-3 shadow-[var(--shadow-surface)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{m.customer.name ?? "—"}</span>
                  <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                    {formatDateTime(m.failedAt ?? m.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 tabular-nums text-[color:var(--color-text-secondary)]">{m.customer.phoneE164}</div>
                <p className="mt-2 text-[color:var(--color-status-error)]">{failureReason(m.failureCode)}</p>
                <div className="mt-2">
                  <Action id={m.id} action={failureAction(m.failureCode, m.retryDueAt)} full />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Card flush>
              <Table head={["Name", "Number", "When", "Reason", ""]} caption="Messages that were not delivered">
                {failed.map((m) => (
                  <Row key={m.id}>
                    <Cell>{m.customer.name ?? "—"}</Cell>
                    <Cell className="tabular-nums">{m.customer.phoneE164}</Cell>
                    <Cell>{formatDateTime(m.failedAt ?? m.createdAt)}</Cell>
                    <Cell>{failureReason(m.failureCode)}</Cell>
                    <Cell>
                      <Action id={m.id} action={failureAction(m.failureCode, m.retryDueAt)} />
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
