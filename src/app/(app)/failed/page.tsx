import { Badge, Card, Cell, EmptyState, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { failureAction, failureReason } from "@/lib/brand/rules";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { resendBrand } from "./actions";

export const dynamic = "force-dynamic";

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
        title="Not delivered"
        description="Messages that did not reach these numbers, why, and what happens next."
      />
      <Card flush>
        {failed.length === 0 ? (
          <EmptyState title="Everything was delivered" description="Failed messages will show up here." />
        ) : (
          <Table head={["Name", "Number", "When", "Reason", ""]} caption="Messages that were not delivered">
            {failed.map((m) => {
              const action = failureAction(m.failureCode, m.retryDueAt);
              return (
                <Row key={m.id}>
                  <Cell>{m.customer.name ?? "—"}</Cell>
                  <Cell className="tabular-nums">{m.customer.phoneE164}</Cell>
                  <Cell>{formatDateTime(m.failedAt ?? m.createdAt)}</Cell>
                  <Cell>{failureReason(m.failureCode)}</Cell>
                  <Cell>
                    {action === "auto" && <Badge tone="info">Retrying automatically in 24h</Badge>}
                    {action === "resend" && (
                      <form action={resendBrand}>
                        <input type="hidden" name="messageId" value={m.id} />
                        <button type="submit" className={buttonClass.secondary}>
                          Resend
                        </button>
                      </form>
                    )}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
