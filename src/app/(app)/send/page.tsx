import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/session";
import { SendForm } from "./send-form";

export const dynamic = "force-dynamic";

export default async function SendPage() {
  await requirePermission("batch:manage");
  return (
    <>
      <PageHeader
        title="Bulk send"
        description="Enter a name and number for each lead. Each number gets one of the 3 Funnel 1 messages at random. No BRAND tap in 3 days sends Funnel 2, then 2 days later Funnel 3; still nothing after 2 more days marks the number red on No reply."
      />
      <SendForm />
    </>
  );
}
