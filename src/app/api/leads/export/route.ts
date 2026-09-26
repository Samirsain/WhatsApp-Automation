import { NextResponse, type NextRequest } from "next/server";
import { csvCell as csv } from "@/lib/brand/rules";
import { parseStage, STAGE_LABELS } from "@/lib/brand/stages";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requirePermission("qualified:export");
  const stage = parseStage(request.nextUrl.searchParams.get("stage"));
  const leads = await prisma.customer.findMany({
    where: { status: "QUALIFIED", ...(stage && { leadStage: stage }) },
    orderBy: { qualifiedAt: "desc" },
    select: { name: true, phoneE164: true, qualifiedAt: true, leadStage: true },
  });
  const body = leads
    .map((l) =>
      [csv(l.name), csv(l.phoneE164), csv(l.qualifiedAt?.toISOString()), csv(STAGE_LABELS[l.leadStage])].join(","),
    )
    .join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = stage ? `-${stage.toLowerCase()}` : "";
  // BOM so Excel reads Hindi names correctly.
  return new NextResponse(`﻿name,phone,clicked_at,status\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-leads${suffix}-${stamp}.csv"`,
    },
  });
}
