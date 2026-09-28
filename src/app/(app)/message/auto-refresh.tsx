"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render the chat every few seconds so new replies and ticks show up, but only while the tab is visible. */
export function AutoRefresh({ everyMs = 8000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
