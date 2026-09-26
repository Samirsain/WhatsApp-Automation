import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

function csv(value: string | null | undefined): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET() {
  await requirePermission("qualified:export");
  const leads = await prisma.customer.findMany({
    where: { status: "QUALIFIED" },
    orderBy: { qualifiedAt: "desc" },
    select: { name: true, phoneE164: true, qualifiedAt: true },
  });
  const body = leads
    .map((l) => [csv(l.name), csv(l.phoneE164), csv(l.qualifiedAt?.toISOString())].join(","))
    .join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel reads Hindi names correctly.
  return new NextResponse(`﻿name,phone,clicked_at\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-leads-${stamp}.csv"`,
    },
  });
}
