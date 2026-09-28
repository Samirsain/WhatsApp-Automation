import { EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/session";
import { openChats } from "@/lib/whatsapp/window";
import { MessageForm } from "./message-form";

export const dynamic = "force-dynamic";

export default async function MessagePage() {
  await requirePermission("batch:manage");
  const chats = await openChats();
  return (
    <>
      <PageHeader
        title="Message one number"
        description="Numbers that messaged you in the last 24 hours. Pick one and send a text, image, video, audio or document. Not part of any funnel."
      />
      {chats.length === 0 ? (
        <EmptyState
          title="No open chats"
          description="Nobody has messaged in the last 24 hours. A number shows up here as soon as it writes to you."
        />
      ) : (
        <MessageForm
          chats={chats.map((c) => ({ ...c, lastAt: c.lastAt.toISOString() }))}
        />
      )}
    </>
  );
}
