"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/ui";

/**
 * Live search: the list updates while you type (after a short pause), no
 * button needed. The query lives in the URL, so it survives a refresh and
 * can be shared. Press "/" anywhere to jump into the box, Esc to clear it.
 */
export function SearchBar({ action, query, placeholder }: { action: string; query: string; placeholder: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function go(next: string, delay = 200) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      start(() => router.replace(q ? `${action}?q=${encodeURIComponent(q)}` : action, { scroll: false }));
    }, delay);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <form
      action={action}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value, 0);
      }}
      className="relative mb-3 print:hidden"
    >
      <svg
        aria-hidden
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--color-text-secondary)]"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={input}
        type="search"
        name="q"
        value={value}
        onChange={(e) => go(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && value && go("", 0)}
        placeholder={placeholder}
        aria-label="Search"
        autoComplete="off"
        className={`${inputClass} pr-20 pl-10 [&::-webkit-search-cancel-button]:hidden`}
      />
      <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {pending && (
          <svg aria-label="Searching" width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin text-[color:var(--color-text-secondary)] motion-reduce:animate-none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              go("", 0);
              input.current?.focus();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]"
          >
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : (
          <kbd className="hidden rounded border border-[color:var(--color-border-default)] px-1.5 text-[length:var(--text-small)] text-[color:var(--color-text-secondary)] md:block">
            /
          </kbd>
        )}
      </span>
    </form>
  );
}
