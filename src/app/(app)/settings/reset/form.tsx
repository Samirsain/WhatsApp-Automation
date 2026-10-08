"use client";

import { useTransition } from "react";
import { wipeTestData } from "./actions";
import { buttonClass } from "@/components/ui";

export function ResetButton() {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={buttonClass.danger}
      disabled={pending}
      onClick={() => {
        if (confirm("Delete batches, logs, and numbers that never replied? Chats are kept. This cannot be undone.")) {
          start(() => wipeTestData());
        }
      }}
    >
      {pending ? "Deleting…" : "Delete all test data"}
    </button>
  );
}
