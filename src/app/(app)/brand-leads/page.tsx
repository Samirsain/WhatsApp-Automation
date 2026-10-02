import { ContactButtons } from "@/components/contact-buttons";
import { Card, Cell, EmptyState, PageHeader, Row, Table, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Tapped Brand and got the guide, but have not tapped Member yet. A Member tap moves them to Final Leads. */
export default async function BrandLeadsPage() {
  await requirePermission("qualified:read");

  const leads = await prisma.customer.findMany({
    where: { qualifiedAt: { not: null }, status: { not: "QUALIFIED" } },
    orderBy: { qualifiedAt: "desc" },
    select: { id: true, name: true, phoneE164: true, qualifiedAt: true },
  });

  return (
    <>
      <PageHeader
        title="Brand Leads"
        description="Tapped Brand and got the guide, but have not tapped Member yet. A Member tap moves them to Final Leads."
        actions={
          <a href="/api/brand-leads/export" className={buttonClass.secondary}>
            CSV download
          </a>
        }
      />
      {leads.length === 0 ? (
        <Card flush>
          <EmptyState title="No one is waiting" description="People who tap Brand but not Member show up here." />
        </Card>
      ) : (
        <>
          {/* Phones and tablets: one card per lead. */}
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {leads.map((l) => (
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
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Card flush>
              <Table head={["Name", "Number", "Tapped Brand at", "Contact"]} caption="Brand Leads">
                {leads.map((l) => (
                  <Row key={l.id}>
                    <Cell>{l.name ?? "—"}</Cell>
                    <Cell className="whitespace-nowrap tabular-nums">{l.phoneE164}</Cell>
                    <Cell className="whitespace-nowrap">{l.qualifiedAt ? formatDateTime(l.qualifiedAt) : "—"}</Cell>
                    <Cell>
                      <ContactButtons phone={l.phoneE164} className="flex" />
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
