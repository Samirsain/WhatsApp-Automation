import { Card, Cell, EmptyState, FilterChip, LeadSteps, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { parseStage, STAGE_LABELS } from "@/lib/brand/stages";
import { formatDateTime } from "@/lib/format";
import { leadId } from "@/lib/lead-id";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PrintButton, StageSelect } from "./lead-controls";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requirePermission("qualified:read");
  // No filter = All. Not interested and Member added each have their own tab.
  const stage = parseStage((await searchParams).stage);

  const [leads, counts, brandCount] = await Promise.all([
    prisma.customer.findMany({
      where: { status: "QUALIFIED", ...(stage && { leadStage: stage }) },
      orderBy: { qualifiedAt: "desc" },
      select: { id: true, leadNumber: true, name: true, phoneE164: true, qualifiedAt: true, leadStage: true },
    }),
    prisma.customer.groupBy({ by: ["leadStage"], where: { status: "QUALIFIED" }, _count: { _all: true } }),
    // Same rule as the Brand Leads page.
    prisma.customer.count({ where: { qualifiedAt: { not: null }, status: { not: "QUALIFIED" } } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.leadStage === s)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);

  return (
    <>
      <PageHeader
        title="Leads"
        actions={
          <>
            <PrintButton />
            <a href={`/api/leads/export${stage ? `?stage=${stage}` : ""}`} className={`${buttonClass.secondary} print:hidden`}>
              CSV download
            </a>
          </>
        }
      />
      <LeadSteps current="final" brand={brandCount} final={total} />
      {/* Phones: one row of chips that scrolls sideways instead of wrapping. */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 print:hidden">
        <FilterChip href="/leads" label="All" count={total} active={!stage} />
        {(["NOT_INTERESTED", "MEMBER_ADDED"] as const).map((s) => (
          <FilterChip key={s} href={`/leads?stage=${s}`} label={STAGE_LABELS[s]} count={countOf(s)} active={stage === s} />
        ))}
      </div>
      {stage && <p className="mb-2 hidden font-semibold print:block">Status: {STAGE_LABELS[stage]}</p>}

      {leads.length === 0 ? (
        <Card flush>
          <EmptyState
            title={stage ? `No ${STAGE_LABELS[stage].toLowerCase()} leads` : "No leads yet"}
            description={
              stage
                ? `Set a lead's status to ${STAGE_LABELS[stage]} and it shows up here.`
                : "People who tap Member on the guide will show up here."
            }
          />
        </Card>
      ) : (
        <>
          {/* Phones and tablets: one card per lead, with big tap targets to reach them. */}
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden print:hidden">
            {leads.map((l) => {
              return (
                <li
                  key={l.id}
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-3 shadow-[var(--shadow-surface)]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{l.name ?? "—"}</span>
                    <span className="shrink-0 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                      {l.qualifiedAt ? formatDateTime(l.qualifiedAt) : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 tabular-nums text-[color:var(--color-text-secondary)]">
                    {leadId(l.leadNumber)} · {l.phoneE164}
                  </div>
                  <div className="mt-2">
                    <StageSelect id={l.id} stage={l.leadStage} className="w-full" />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden lg:block print:block">
            <Card flush>
              <Table head={["Lead ID", "Name", "Number", "Tapped Member at", "Status"]} caption="Final Leads">
                {leads.map((l) => {
                  return (
                    <Row key={l.id}>
                      <Cell className="whitespace-nowrap tabular-nums">{leadId(l.leadNumber)}</Cell>
                      <Cell>{l.name ?? "—"}</Cell>
                      <Cell className="whitespace-nowrap tabular-nums">{l.phoneE164}</Cell>
                      <Cell className="whitespace-nowrap">{l.qualifiedAt ? formatDateTime(l.qualifiedAt) : "—"}</Cell>
                      <Cell>
                        <StageSelect id={l.id} stage={l.leadStage} />
                        <span className="hidden print:inline">{STAGE_LABELS[l.leadStage]}</span>
                      </Cell>
                    </Row>
                  );
                })}
              </Table>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
