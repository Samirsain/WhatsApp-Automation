import { Card, Cell, EmptyState, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requirePermission("qualified:read");
  const leads = await prisma.customer.findMany({
    where: { status: "QUALIFIED" },
    orderBy: { qualifiedAt: "desc" },
    select: { id: true, name: true, phoneE164: true, qualifiedAt: true },
  });

  return (
    <>
      <PageHeader
        title="BRAND leads"
        description="Everyone who tapped the BRAND button. Each one was sent the thank-you message automatically."
        actions={
          <a href="/api/leads/export" className={buttonClass.secondary}>
            CSV download
          </a>
        }
      />
      <Card flush>
        {leads.length === 0 ? (
          <EmptyState title="No leads yet" description="People who tap BRAND will show up here." />
        ) : (
          <Table head={["Name", "Number", "Tapped at"]} caption="BRAND leads">
            {leads.map((l) => (
              <Row key={l.id}>
                <Cell>{l.name ?? "—"}</Cell>
                <Cell className="tabular-nums">{l.phoneE164}</Cell>
                <Cell>{l.qualifiedAt ? formatDateTime(l.qualifiedAt) : "—"}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
