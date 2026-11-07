import Link from "next/link";
import { buttonClass, inputClass } from "@/components/ui";

/** A plain GET form: the query lives in the URL, so it survives a refresh and can be shared. */
export function SearchBar({ action, query, placeholder }: { action: string; query: string; placeholder: string }) {
  return (
    <form action={action} role="search" className="mb-3 flex gap-2 print:hidden">
      <input
        type="search"
        name="q"
        defaultValue={query}
        placeholder={placeholder}
        aria-label="Search"
        autoComplete="off"
        className={`${inputClass} flex-1`}
      />
      <button type="submit" className={buttonClass.secondary}>
        Search
      </button>
      {query && (
        <Link href={action} className={buttonClass.secondary}>
          Clear
        </Link>
      )}
    </form>
  );
}
