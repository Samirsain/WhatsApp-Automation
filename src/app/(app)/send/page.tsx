import { PageHeader } from "@/components/ui";
import { getFundsSnapshot } from "@/lib/brand/funds-server";
import { requirePermission } from "@/lib/session";
import { FundsCard } from "./funds-card";
import { SendForm } from "./send-form";

export const dynamic = "force-dynamic";

export default async function SendPage() {
  await requirePermission("batch:manage");
  const funds = await getFundsSnapshot();
  return (
    <>
      <PageHeader
        title="Bulk send"
        description="Enter a name and number for each lead. Each number gets one of the 3 property brand templates, picked at random."
      />
      <FundsCard funds={funds} />
      <SendForm messagesLeft={funds.messagesLeft} />
    </>
  );
}
