import { NextResponse } from "next/server";
import { csvCell as csv } from "@/lib/brand/rules";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Brand Leads as CSV: tapped Brand, not Member yet. Same rows as the page. */
export async function GET() {
  await requirePermission("qualified:export");
  const leads = await prisma.customer.findMany({
    where: { qualifiedAt: { not: null }, status: { not: "QUALIFIED" } },
    orderBy: { qualifiedAt: "desc" },
    select: { name: true, phoneE164: true, qualifiedAt: true },
  });
  const body = leads
    .map((l) => [csv(l.name), csv(l.phoneE164), csv(l.qualifiedAt?.toISOString())].join(","))
    .join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel reads Hindi names correctly.
  return new NextResponse(`﻿name,phone,brand_clicked_at\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-leads-${stamp}.csv"`,
    },
  });
}
