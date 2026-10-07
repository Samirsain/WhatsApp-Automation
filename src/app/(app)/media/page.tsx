import Link from "next/link";
import { Card, EmptyState, FilterChip, PageHeader, buttonClass, cx, inputClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

type Payload = { mediaType?: string; mediaId?: string; filename?: string; link?: string } | null;

const KINDS = [
  { key: "document", label: "Documents", icon: "📄" },
  { key: "image", label: "Photos", icon: "🖼️" },
  { key: "video", label: "Videos", icon: "🎬" },
  { key: "audio", label: "Voice / audio", icon: "🎤" },
  { key: "sticker", label: "Stickers", icon: "🙂" },
] as const;

/** Meta keeps a file about 30 days; one that never reached Cloudinary is gone after that. */
const META_KEEPS_MS = 30 * 24 * 60 * 60_000;

/** Every file a customer sent, grouped by number. */
export default async function MediaPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  await requirePermission("batch:manage");
  const { type, q } = await searchParams;
  const search = q?.trim() ?? "";
  const now = new Date().getTime();

  // ponytail: loads the newest 2000 files and groups in memory; paginate by number if that cap is ever hit.
  const rows = await prisma.message.findMany({
    where: {
      direction: "INBOUND",
      type: "MEDIA",
      ...(search && {
        customer: {
          OR: [
            { phoneE164: { contains: search.replace(/[^\d+]/g, "") || search } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        },
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: { id: true, body: true, payload: true, createdAt: true, customer: { select: { id: true, name: true, phoneE164: true } } },
  });

  const files = rows.map((r) => ({ ...r, p: r.payload as Payload }));
  const counts = Object.fromEntries(KINDS.map((k) => [k.key, files.filter((f) => f.p?.mediaType === k.key).length]));
  const shown = KINDS.some((k) => k.key === type) ? files.filter((f) => f.p?.mediaType === type) : files;

  // Newest sender first; Map keeps insertion order.
  const groups = new Map<string, { customer: (typeof files)[number]["customer"]; files: typeof files }>();
  for (const f of shown) {
    const g = groups.get(f.customer.id) ?? { customer: f.customer, files: [] };
    g.files.push(f);
    groups.set(f.customer.id, g);
  }

  const href = (t?: string) => {
    const params = new URLSearchParams({ ...(t && { type: t }), ...(search && { q: search }) });
    return `/media${params.size ? `?${params}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Media" description="Every photo, video, voice note and document customers sent, by number." />

      <form action="/media" className="mb-3 flex gap-2">
        {type && <input type="hidden" name="type" value={type} />}
        <input
          name="q"
          defaultValue={search}
          placeholder="Search number or name"
          aria-label="Search number or name"
          className={cx(inputClass, "max-w-xs")}
        />
        <button className={buttonClass.secondary}>Search</button>
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip href={href()} label="All" count={files.length} active={!type} />
        {KINDS.map((k) => (
          <FilterChip key={k.key} href={href(k.key)} label={k.label} count={counts[k.key]} active={type === k.key} />
        ))}
      </div>

      {groups.size === 0 ? (
        <Card flush>
          <EmptyState
            title={search ? "Nothing from that number" : "No files yet"}
            description="Anything a customer sends on WhatsApp — photos, documents, voice notes — shows up here."
          />
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {[...groups.values()].map(({ customer, files }) => (
            <li
              key={customer.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface)] shadow-[var(--shadow-surface)]"
            >
              <div className="flex items-center gap-3 border-b border-[color:var(--color-border-default)] px-3 py-2.5">
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate font-semibold">{customer.name || customer.phoneE164}</div>
                  <div className="text-[length:var(--text-small)] tabular-nums text-[color:var(--color-text-secondary)]">
                    {customer.name && `${customer.phoneE164} · `}
                    {files.length} {files.length === 1 ? "file" : "files"}
                  </div>
                </div>
                <Link href={`/message?c=${customer.id}`} className={buttonClass.secondary}>
                  Open chat
                </Link>
              </div>
              <ul>
                {files.map((f) => {
                  const kind = KINDS.find((k) => k.key === f.p?.mediaType);
                  const expired = !f.p?.link && now - f.createdAt.getTime() > META_KEEPS_MS;
                  const src = f.p?.link ?? (f.p?.mediaId ? `/api/whatsapp-media/${f.p.mediaId}` : undefined);
                  const name = f.p?.filename || f.body || kind?.label.replace(/s$/, "") || "File";
                  return (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 border-b border-[color:var(--color-border-default)] px-3 py-2 last:border-b-0"
                    >
                      <span aria-hidden className="text-lg">
                        {kind?.icon ?? "📎"}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        {src && !expired ? (
                          <a href={src} target="_blank" rel="noreferrer" className="block truncate underline-offset-2 hover:underline">
                            {name}
                          </a>
                        ) : (
                          <span className="block truncate text-[color:var(--color-text-secondary)]">{name}</span>
                        )}
                        <span className="text-[length:var(--text-small)] text-[color:var(--color-text-secondary)]">
                          {formatDateTime(f.createdAt)}
                          {expired && " · Expired on WhatsApp"}
                          {!f.p?.link && !expired && " · Not saved yet"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
