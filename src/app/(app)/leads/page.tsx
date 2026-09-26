import { Card, Cell, EmptyState, FilterChip, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { LEAD_STAGES, parseStage, STAGE_LABELS } from "@/lib/brand/stages";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PrintButton, StageSelect } from "./lead-controls";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requirePermission("qualified:read");
  const stage = parseStage((await searchParams).stage);

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
        description="Everyone who tapped the BRAND button. Each one was sent the thank-you message automatically."
        actions={
          <>
            <PrintButton />
            <a href={`/api/leads/export${stage ? `?stage=${stage}` : ""}`} className={`${buttonClass.secondary} print:hidden`}>
              CSV download
            </a>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        <FilterChip href="/leads" label="All" count={total} active={!stage} />
        {LEAD_STAGES.map((s) => (
          <FilterChip key={s} href={`/leads?stage=${s}`} label={STAGE_LABELS[s]} count={countOf(s)} active={stage === s} />
        ))}
      </div>
      {stage && <p className="mb-2 hidden font-semibold print:block">Status: {STAGE_LABELS[stage]}</p>}
      <Card flush>
        {leads.length === 0 ? (
          <EmptyState
            title={stage ? `No ${STAGE_LABELS[stage].toLowerCase()} leads` : "No leads yet"}
            description="People who tap BRAND will show up here."
          />
        ) : (
          <Table head={["Name", "Number", "Tapped at", "Status"]} caption="BRAND leads">
            {leads.map((l) => {
              const digits = l.phoneE164.replace(/\D/g, "");
              return (
                <Row key={l.id}>
                  <Cell>{l.name ?? "—"}</Cell>
                  <Cell className="tabular-nums">
                    <span>{l.phoneE164}</span>
                    <span className="ml-2 inline-flex gap-2 text-[length:var(--text-small)] print:hidden">
                      <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="underline">
                        WhatsApp
                      </a>
                      <a href={`tel:${l.phoneE164}`} className="underline">
                        Call
                      </a>
                    </span>
                  </Cell>
                  <Cell>{l.qualifiedAt ? formatDateTime(l.qualifiedAt) : "—"}</Cell>
                  <Cell>
                    <StageSelect id={l.id} stage={l.leadStage} />
                    <span className="hidden print:inline">{STAGE_LABELS[l.leadStage]}</span>
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
