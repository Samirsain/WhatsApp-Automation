import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/session";
import { SendForm } from "./send-form";

export const dynamic = "force-dynamic";

export default async function SendPage() {
  await requirePermission("batch:manage");
  return (
    <>
      <PageHeader title="Broadcast" description="Enter a name and number for each lead." />
      <SendForm />
    </>
  );
}
