'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Command, Loader2, ArrowRight } from 'lucide-react';
import { Kbd } from './Kbd';

export type CommandResult = {
  type: 'project' | 'client' | 'profile' | 'equipment' | 'freelancer' | 'talent';
  id: string;
  label: string;
  sublabel?: string | null;
  href: string;
};

const TYPE_LABEL: Record<CommandResult['type'], string> = {
  project: 'مشروع',
  client: 'عميل',
  profile: 'شخص',
  equipment: 'معدة',
  freelancer: 'فريلانسر',
  talent: 'موهبة',
};

const TYPE_COLOR: Record<CommandResult['type'], string> = {
  project: 'text-[var(--accent)]',
  client: 'text-blue-400',
  profile: 'text-purple-400',
  equipment: 'text-emerald-400',
  freelancer: 'text-orange-400',
  talent: 'text-pink-400',
};

const QUICK_ACTIONS: CommandResult[] = [
  { type: 'project', id: '__nav-projects', label: 'كل المشاريع', href: '/projects' },
  { type: 'project', id: '__new-project', label: 'مشروع جديد', sublabel: 'إنشاء', href: '/projects/new' },
  { type: 'client', id: '__nav-clients', label: 'كل العملاء', href: '/crm' },
  { type: 'client', id: '__new-client', label: 'عميل جديد', sublabel: 'إنشاء', href: '/clients/new' },
  { type: 'client', id: '__nav-contacts', label: 'جهات الاتصال', href: '/contacts' },
  { type: 'client', id: '__new-contact', label: 'جهة اتصال جديدة', sublabel: 'إنشاء', href: '/contacts/new' },
  { type: 'equipment', id: '__nav-eq', label: 'كل المعدات', href: '/equipment' },
  { type: 'equipment', id: '__nav-eq-res', label: 'حجوزات المعدات', sublabel: 'تسليم/استرجاع', href: '/equipment/reservations' },
  { type: 'equipment', id: '__new-eq', label: 'معدّة جديدة', sublabel: 'إنشاء', href: '/equipment/new' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchSeqRef = useRef(0);

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setActiveIdx(0);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          if (seq === fetchSeqRef.current) {
            setResults([]);
            setLoading(false);
          }
          return;
        }
        const data = (await res.json()) as { results: CommandResult[] };
        if (seq === fetchSeqRef.current) {
          setResults(data.results ?? []);
          setActiveIdx(0);
          setLoading(false);
        }
      } catch {
        if (seq === fetchSeqRef.current) {
          setResults([]);
          setLoading(false);
        }
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const shown = query.trim()
    ? results
    : QUICK_ACTIONS;

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, shown.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const item = shown[activeIdx];
        if (item) {
          window.location.href = item.href;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, shown, activeIdx]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ابحث عن مشروع، عميل، شخص، معدة"
        className="hidden h-9 w-full min-w-[260px] items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)] md:flex"
      >
        <Search size={14} />
        <span>ابحث في Antagna — مشروع، عميل، شخص، معدة…</span>
        <span className="ms-auto inline-flex items-center gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm px-4 pt-[10vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/95 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
              {loading ? (
                <Loader2 size={16} className="animate-spin text-[var(--text-dim)]" />
              ) : (
                <Search size={16} className="text-[var(--text-dim)]" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن مشروع، عميل، شخص، معدة…"
                className="flex-1 bg-transparent py-4 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none"
              />
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {shown.length === 0 ? (
                query.trim() ? (
                  <div className="px-4 py-12 text-center text-sm text-[var(--text-dim)]">
                    {loading ? 'جاري البحث…' : 'لا نتائج'}
                  </div>
                ) : (
                  <div className="px-4 py-12 text-center text-sm text-[var(--text-dim)]">
                    ابدأ الكتابة للبحث
                  </div>
                )
              ) : (
                <>
                  {!query.trim() && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      اختصارات
                    </p>
                  )}
                  <ul>
                    {shown.map((r, i) => (
                      <li key={r.type + r.id}>
                        <a
                          href={r.href}
                          onMouseEnter={() => setActiveIdx(i)}
                          className={
                            'flex items-center gap-3 rounded-md px-3 py-2.5 ' +
                            (i === activeIdx
                              ? 'bg-[var(--surface)]'
                              : 'hover:bg-[var(--surface)]/60')
                          }
                        >
                          <span
                            className={
                              'text-[10px] font-semibold uppercase tracking-wider w-14 ' +
                              TYPE_COLOR[r.type]
                            }
                          >
                            {TYPE_LABEL[r.type]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-[var(--text)]">
                              {r.label}
                            </p>
                            {r.sublabel && (
                              <p className="truncate text-xs text-[var(--text-muted)]">
                                {r.sublabel}
                              </p>
                            )}
                          </div>
                          {i === activeIdx && (
                            <ArrowRight
                              size={14}
                              className="text-[var(--accent)] rtl:rotate-180"
                            />
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--bg)]/60 px-4 py-2 text-[10px] text-[var(--text-dim)]">
              <div className="flex items-center gap-2">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span>تنقّل</span>
                <span className="mx-2">·</span>
                <Kbd>↵</Kbd>
                <span>افتح</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Command size={10} />
                Command Palette
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
