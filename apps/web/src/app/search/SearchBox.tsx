'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Client search input for the dedicated /search page. Submits to /search?q=…
 * (server reads ?q and runs the cross-entity query). Kept thin: no client-side
 * fetching — the server page is the source of truth so results are shareable
 * via URL and survive refresh.
 */
export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(next: string) {
    const q = next.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="relative"
      role="search"
    >
      <Search
        size={17}
        className="pointer-events-none absolute top-1/2 start-4 -translate-y-1/2 text-[var(--text-dim)]"
      />
      <input
        ref={inputRef}
        type="search"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ابحث في المشاريع، العملاء، جهات الاتصال، المعدات، الفريق…"
        className="h-14 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] ps-12 pe-12 text-[15px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
        // Hide the native clear button — we render our own.
        style={{ appearance: 'none' }}
      />
      {value && (
        <button
          type="button"
          aria-label="مسح"
          onClick={() => {
            setValue('');
            inputRef.current?.focus();
            submit('');
          }}
          className="absolute top-1/2 end-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      )}
    </form>
  );
}
