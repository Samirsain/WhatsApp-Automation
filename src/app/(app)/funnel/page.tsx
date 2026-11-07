import { SearchBar } from "@/components/search-bar";
import { Badge, buttonClass, Card, Cell, cx, EmptyState, PageHeader, Row, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { deliveryLabel, matchesSearch, type DeliveryLabel } from "@/lib/funnel-list";
import { funnelRows, type FunnelRow } from "@/lib/funnel-rows";
import { leadId } from "@/lib/lead-id";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { markInterested, markNotInterested } from "./actions";

export const dynamic = "force-dynamic";

const TONE: Record<DeliveryLabel, "error" | "info" | "success"> = {
  "Not delivered": "error",
  Delivered: "info",
  Seen: "success",
};
const RED_BG = "bg-[color:var(--color-status-error)]/10";
const GREEN_BUTTON = cx(buttonClass.primary, "bg-[color:var(--color-status-success)] hover:bg-[color:var(--color-status-success)] hover:opacity-90");

function Status({ status }: { status: string }) {
  const label = deliveryLabel(status);
  return <Badge tone={TONE[label]} dot>{label}</Badge>;
}

/** Red "Not interested" moves them to that menu; green "Interested" adds them to Chats and opens it. */
function Decide({ m, className }: { m: FunnelRow; className?: string }) {
  return (
    <div className={cx("flex gap-2", className)}>
      <form action={markNotInterested.bind(null, m.customerId)} className="contents">
        <button type="submit" className={buttonClass.danger}>
          Not interested
        </button>
      </form>
      <form action={markInterested.bind(null, m.customerId)} className="contents">
        <button type="submit" className={GREEN_BUTTON}>
          Interested
        </button>
      </form>
    </div>
  );
}

/** Everyone the funnel messaged and who has not tapped Brand or said no; 3/3 on top. */
export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("batch:read");
  const canManage = can(user.roles, "batch:manage");
  const query = (await searchParams).q?.trim() ?? "";

  const all = await funnelRows();
  const rows = all.filter((m) => matchesSearch(m.customer, query));

  return (
    <>
      <PageHeader title="Funnel" />
      <SearchBar action="/funnel" query={query} placeholder="Search name, number or ID" />
      {rows.length === 0 ? (
        <Card flush>
          {query ? (
            <EmptyState title="No match" description={`Nobody in the funnel matches "${query}".`} />
          ) : (
            <EmptyState title="The funnel is empty" description="Numbers you broadcast to show up here." />
          )}
        </Card>
      ) : (
        <>
          {/* Phones and tablets: one card per number. */}
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {rows.map((m) => (
              <li
                key={m.id}
                className={cx(
                  "rounded-[var(--radius-md)] border p-3 shadow-[var(--shadow-surface)]",
                  m.customer.status === "NO_RESPONSE"
                    ? `border-[color:var(--color-status-error)] ${RED_BG}`
                    : "border-[color:var(--color-border-default)] bg-[color:var(--color-surface)]",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{m.customer.name ?? "—"}</span>
                  <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                    {formatDateTime(m.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="tabular-nums text-[color:var(--color-text-secondary)]">
                    {leadId(m.customer.leadNumber)} · {m.customer.phoneE164}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Badge>{m.step}/3</Badge>
                    <Status status={m.deliveryStatus} />
                  </span>
                </div>
                {canManage && <Decide m={m} className="mt-2 grid grid-cols-2" />}
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Card flush>
              <Table
                head={["ID", "Name", "Number", "Date", "Stage", "Status", ...(canManage ? [""] : [])]}
                caption="Everyone in the funnel, furthest stage first"
              >
                {rows.map((m) => (
                  <Row key={m.id} className={m.customer.status === "NO_RESPONSE" ? RED_BG : undefined}>
                    <Cell className="whitespace-nowrap tabular-nums">{leadId(m.customer.leadNumber)}</Cell>
                    <Cell>{m.customer.name ?? "—"}</Cell>
                    <Cell className="whitespace-nowrap tabular-nums">{m.customer.phoneE164}</Cell>
                    <Cell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</Cell>
                    <Cell className="whitespace-nowrap font-semibold tabular-nums">{m.step}/3</Cell>
                    <Cell>
                      <Status status={m.deliveryStatus} />
                    </Cell>
                    {canManage && (
                      <Cell>
                        <Decide m={m} />
                      </Cell>
                    )}
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
