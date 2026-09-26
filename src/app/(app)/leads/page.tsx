import { ContactButtons } from "@/components/contact-buttons";
import { Card, Cell, EmptyState, FilterChip, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { LEAD_STAGES, parseStage, STAGE_LABELS } from "@/lib/brand/stages";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PrintButton, StageSelect } from "./lead-controls";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requirePermission("qualified:read");
  // No filter = the to-do list: only NEW. Changing a lead's status moves it to that
  // status's tab, so the team never works the same lead twice. "all" shows everyone.
  const raw = (await searchParams).stage;
  const showAll = raw === "all";
  const stage = showAll ? null : (parseStage(raw) ?? "NEW");

  const [leads, counts] = await Promise.all([
    prisma.customer.findMany({
      where: { status: "QUALIFIED", ...(stage && { leadStage: stage }) },
      orderBy: { qualifiedAt: "desc" },
      select: { id: true, name: true, phoneE164: true, qualifiedAt: true, leadStage: true },
    }),
    prisma.customer.groupBy({ by: ["leadStage"], where: { status: "QUALIFIED" }, _count: { _all: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.leadStage === s)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);

  return (
    <>
      <PageHeader
        title="BRAND leads"
        description="Everyone who tapped BRAND (each got the thank-you automatically). Set a status and the lead moves to that tab."
        actions={
          <>
            <PrintButton />
            <a href={`/api/leads/export${stage ? `?stage=${stage}` : ""}`} className={`${buttonClass.secondary} print:hidden`}>
              CSV download
            </a>
          </>
        }
      />
      {/* Phones: one row of chips that scrolls sideways instead of wrapping. */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 print:hidden">
        {LEAD_STAGES.map((s) => (
          <FilterChip
            key={s}
            href={s === "NEW" ? "/leads" : `/leads?stage=${s}`}
            label={STAGE_LABELS[s]}
            count={countOf(s)}
            active={stage === s}
          />
        ))}
        <FilterChip href="/leads?stage=all" label="All" count={total} active={showAll} />
      </div>
      {stage && <p className="mb-2 hidden font-semibold print:block">Status: {STAGE_LABELS[stage]}</p>}

      {leads.length === 0 ? (
        <Card flush>
          <EmptyState
            title={stage ? `No ${STAGE_LABELS[stage].toLowerCase()} leads` : "No leads yet"}
            description={
              stage === "NEW"
                ? "New taps on BRAND show up here. Change a lead's status and it moves to that tab."
                : "People who tap BRAND will show up here."
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
                  <div className="mt-0.5 tabular-nums text-[color:var(--color-text-secondary)]">{l.phoneE164}</div>
                  <ContactButtons phone={l.phoneE164} className="mt-2 grid grid-cols-2" />
                  <div className="mt-2">
                    <StageSelect id={l.id} stage={l.leadStage} className="w-full" />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden lg:block print:block">
            <Card flush>
              <Table head={["Name", "Number", "Tapped at", <span key="c" className="print:hidden">Contact</span>, "Status"]} caption="BRAND leads">
                {leads.map((l) => {
                  return (
                    <Row key={l.id}>
                      <Cell>{l.name ?? "—"}</Cell>
                      <Cell className="whitespace-nowrap tabular-nums">{l.phoneE164}</Cell>
                      <Cell className="whitespace-nowrap">{l.qualifiedAt ? formatDateTime(l.qualifiedAt) : "—"}</Cell>
                      <Cell className="print:hidden">
                        <ContactButtons phone={l.phoneE164} className="flex" />
                      </Cell>
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
