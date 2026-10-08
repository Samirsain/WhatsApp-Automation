import { ContactButtons } from "@/components/contact-buttons";
import { Card, Cell, EmptyState, FilterChip, LeadSteps, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { LEAD_STAGES, parseStage, STAGE_HINTS, STAGE_LABELS } from "@/lib/brand/stages";
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

  const [leads, counts, brandCount] = await Promise.all([
    prisma.customer.findMany({
      where: { status: "QUALIFIED", ...(stage && { leadStage: stage }) },
      orderBy: { qualifiedAt: "desc" },
      select: { id: true, name: true, phoneE164: true, qualifiedAt: true, leadStage: true },
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
        title="Final Leads"
        description="People who tapped Member on the guide and got the thank-you automatically. These are the real leads: contact them and set a status, and the lead moves to that status's tab."
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
      {stage && (
        <p className="mb-2 text-[color:var(--color-text-secondary)] print:hidden">
          <span className="font-semibold text-[color:var(--color-text-primary)]">{STAGE_LABELS[stage]}:</span>{" "}
          {STAGE_HINTS[stage].meaning}.{" "}
          <span className="font-semibold text-[color:var(--color-action-primary-hover)]">Next: {STAGE_HINTS[stage].next}.</span>
        </p>
      )}
      <details className="mb-3 text-[length:var(--text-small)] print:hidden">
        <summary className="cursor-pointer font-medium text-[color:var(--color-text-secondary)]">What do the statuses mean?</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1.5 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] p-3 sm:grid-cols-[auto_1fr]">
          {LEAD_STAGES.map((s) => (
            <div key={s} className="contents">
              <dt className="font-semibold">{STAGE_LABELS[s]}</dt>
              <dd className="mb-1 sm:mb-0">
                {STAGE_HINTS[s].meaning}.{" "}
                <span className="text-[color:var(--color-text-secondary)]">Next: {STAGE_HINTS[s].next}.</span>
              </dd>
            </div>
          ))}
        </dl>
      </details>
      {stage && <p className="mb-2 hidden font-semibold print:block">Status: {STAGE_LABELS[stage]}</p>}

      {leads.length === 0 ? (
        <Card flush>
          <EmptyState
            title={stage ? `No ${STAGE_LABELS[stage].toLowerCase()} leads` : "No leads yet"}
            description={
              stage === "NEW"
                ? "New Member taps show up here. Change a lead's status and it moves to that tab."
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
              <Table head={["Name", "Number", "Tapped Member at", <span key="c" className="print:hidden">Contact</span>, "Status"]} caption="Final Leads">
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
