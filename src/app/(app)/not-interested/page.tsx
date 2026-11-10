import { Highlight } from "@/components/highlight";
import { SearchBar } from "@/components/search-bar";
import { Badge, Card, Cell, EmptyState, PageHeader, Row, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { deliveryLabel, search, stepOf } from "@/lib/funnel-list";
import { leadId } from "@/lib/lead-id";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

type Lead = Awaited<ReturnType<typeof load>>[number];

/** Everyone marked Not interested and not archived or blocked, newest first, with how far their funnel got. */
function load() {
  return prisma.customer.findMany({
    where: { status: "NOT_INTERESTED", chatArchivedAt: null, blockedAt: null },
    orderBy: [{ notInterestedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    take: 2000, // ponytail: paginate if the list outgrows it
    select: {
      id: true,
      leadNumber: true,
      name: true,
      phoneE164: true,
      notInterestedAt: true,
      updatedAt: true,
      messages: {
        where: { direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { payload: true, deliveryStatus: true },
      },
    },
  });
}

const stage = (c: Lead) => (c.messages[0] ? `${stepOf(c.messages[0].payload)}/3` : "—");
const status = (c: Lead) => (c.messages[0] ? deliveryLabel(c.messages[0].deliveryStatus) : null);

export default async function NotInterestedPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("batch:read");
  const query = (await searchParams).q?.trim() ?? "";
  const rows = search(await load(), query, (c) => c);

  return (
    <>
      <PageHeader title="Not Interested" />
      <SearchBar action="/not-interested" query={query} placeholder="Search name, number or ID" />
      {rows.length === 0 ? (
        <Card flush>
          {query ? (
            <EmptyState title="No match" description={`Nobody here matches "${query}".`} />
          ) : (
            <EmptyState title="Nobody here yet" description='Tap "Not interested" on the Funnel page and the number moves here.' />
          )}
        </Card>
      ) : (
        <>
          {/* Phones and tablets: one card per number. */}
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {rows.map((c) => (
              <li
                key={c.id}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-3 shadow-[var(--shadow-surface)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{c.name ? <Highlight text={c.name} query={query} /> : "—"}</span>
                  <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                    {formatDateTime(c.notInterestedAt ?? c.updatedAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="tabular-nums text-[color:var(--color-text-secondary)]">
                    {leadId(c.leadNumber)} · <Highlight text={c.phoneE164} query={query} kind="number" />
                  </span>
                  <Badge>{stage(c)}</Badge>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Card flush>
              <Table
                head={["ID", "Name", "Number", "Marked on", "Stage", "Status"]}
                caption="Numbers marked Not interested"
              >
                {rows.map((c) => (
                  <Row key={c.id}>
                    <Cell className="whitespace-nowrap tabular-nums">{leadId(c.leadNumber)}</Cell>
                    <Cell>{c.name ? <Highlight text={c.name} query={query} /> : "—"}</Cell>
                    <Cell className="whitespace-nowrap tabular-nums"><Highlight text={c.phoneE164} query={query} kind="number" /></Cell>
                    <Cell className="whitespace-nowrap">{formatDateTime(c.notInterestedAt ?? c.updatedAt)}</Cell>
                    <Cell className="whitespace-nowrap tabular-nums">{stage(c)}</Cell>
                    <Cell>{status(c) ?? "—"}</Cell>
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
