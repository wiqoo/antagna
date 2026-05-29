'use client';

/**
 * ListWorkspace<T> — the reusable list surface for every entity page
 * (equipment, inbox, projects, clients, team, …). Headless about data: the
 * server page fetches rows; this component does client-side search + filter +
 * sort + view-mode (cards / table / compact) + a saved view (localStorage).
 *
 * RTL, Arabic-first, DNA tokens. Matches the existing equipment table look.
 */
import {
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { Search, LayoutGrid, Table2, Rows3, ArrowUpDown, X } from 'lucide-react';
import { EmptyState } from './EmptyState';

export type ViewMode = 'cards' | 'table' | 'compact';

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
}

export interface ColumnDef<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

export interface ListWorkspaceProps<T> {
  rows: T[];
  storageKey: string;
  getId: (row: T) => string;
  searchText: (row: T) => string;
  filters?: FilterDef<T>[];
  columns: ColumnDef<T>[];
  renderCard: (row: T) => ReactNode;
  renderCompact?: (row: T) => ReactNode;
  defaultView?: ViewMode;
  initialFilters?: Record<string, string>;
  toolbarExtra?: ReactNode;
  emptyState?: ReactNode;
}

interface SavedState {
  view?: ViewMode;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  activeFilters?: Record<string, string>;
}

export function ListWorkspace<T>({
  rows,
  storageKey,
  getId,
  searchText,
  filters = [],
  columns,
  renderCard,
  renderCompact,
  defaultView = 'table',
  initialFilters,
  toolbarExtra,
  emptyState,
}: ListWorkspaceProps<T>) {
  const [view, setView] = useState<ViewMode>(defaultView);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(
    initialFilters ?? {},
  );
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Hydrate saved view (SSR-safe: only touch localStorage after mount).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`lw:${storageKey}`);
      if (raw) {
        const s = JSON.parse(raw) as SavedState;
        if (s.view) setView(s.view);
        if (s.sortKey !== undefined) setSortKey(s.sortKey);
        if (s.sortDir) setSortDir(s.sortDir);
        if (s.activeFilters && !initialFilters) setActiveFilters(s.activeFilters);
      } else if (window.innerWidth < 640) {
        setView('cards');
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist saved view.
  useEffect(() => {
    try {
      localStorage.setItem(
        `lw:${storageKey}`,
        JSON.stringify({ view, sortKey, sortDir, activeFilters }),
      );
    } catch {
      /* ignore */
    }
  }, [storageKey, view, sortKey, sortDir, activeFilters]);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [query]);

  const visible = useMemo(() => {
    let out = rows;
    for (const f of filters) {
      const v = activeFilters[f.key];
      if (v) out = out.filter((r) => f.predicate(r, v));
    }
    if (debounced) {
      out = out.filter((r) => searchText(r).toLowerCase().includes(debounced));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        const sv = col.sortValue;
        out = [...out].sort((a, b) => {
          const av = sv(a);
          const bv = sv(b);
          const cmp =
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv), 'ar');
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, filters, activeFilters, debounced, searchText, sortKey, sortDir, columns]);

  const sortableCols = columns.filter((c) => c.sortable && c.sortValue);
  const chip =
    'rounded-full border px-3 py-1 text-[12px] transition-colors cursor-pointer';
  const chipOn =
    'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]';
  const chipOff =
    'border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]';

  function toggleFilter(key: string, value: string) {
    setActiveFilters((prev) =>
      prev[key] === value ? omit(prev, key) : { ...prev, [key]: value },
    );
  }

  const viewBtn = (m: ViewMode, Icon: typeof LayoutGrid, label: string) => (
    <button
      type="button"
      aria-label={label}
      onClick={() => setView(m)}
      className={`flex h-8 w-8 items-center justify-center rounded-md border ${
        view === m
          ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--text)]'
      }`}
    >
      <Icon size={15} />
    </button>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--text-dim)] start-3"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث…"
            aria-label="بحث"
            className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] ps-9 pe-3 text-[13px] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {sortableCols.length > 0 && (
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={13} className="text-[var(--text-dim)]" />
            <select
              value={sortKey ?? ''}
              onChange={(e) => setSortKey(e.target.value || null)}
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]"
            >
              <option value="">بدون ترتيب</option>
              {sortableCols.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.header}
                </option>
              ))}
            </select>
            {sortKey && (
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="h-9 rounded-md border border-[var(--line)] px-2 text-[12px] text-[var(--text-muted)]"
              >
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          {viewBtn('cards', LayoutGrid, 'عرض بطاقات')}
          {viewBtn('table', Table2, 'عرض جدول')}
          {viewBtn('compact', Rows3, 'عرض مضغوط')}
        </div>

        {toolbarExtra && <div className="ms-auto">{toolbarExtra}</div>}
      </div>

      {/* Filter chips */}
      {filters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {filters.map((f) =>
            f.options.map((o) => {
              const on = activeFilters[f.key] === o.value;
              return (
                <button
                  key={`${f.key}:${o.value}`}
                  type="button"
                  onClick={() => toggleFilter(f.key, o.value)}
                  className={`${chip} ${on ? chipOn : chipOff}`}
                >
                  {o.label}
                  {on && <X size={11} className="ms-1 inline" />}
                </button>
              );
            }),
          )}
          {Object.keys(activeFilters).length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilters({})}
              className="text-[12px] text-[var(--text-dim)] underline hover:text-[var(--text)]"
            >
              مسح الكل
            </button>
          )}
        </div>
      )}

      {/* Count */}
      <p className="mb-3 text-[12px] text-[var(--text-dim)]">{visible.length} عنصر</p>

      {/* Body */}
      {visible.length === 0 ? (
        emptyState ?? (
          <EmptyState title="لا نتائج" description="جرّب تعديل البحث أو الفلاتر." />
        )
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <div key={getId(r)}>{renderCard(r)}</div>
          ))}
        </div>
      ) : view === 'compact' ? (
        <div className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
          {visible.map((r) => (
            <div key={getId(r)} className="px-4 py-2.5 text-[13px] hover:bg-[var(--bg-elevated)]/60">
              {renderCompact
                ? renderCompact(r)
                : columns.slice(0, 3).map((c) => (
                    <span key={c.key} className="me-3">
                      {c.cell(r)}
                    </span>
                  ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/60">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => {
                      if (!c.sortable || !c.sortValue) return;
                      if (sortKey === c.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      else {
                        setSortKey(c.key);
                        setSortDir('asc');
                      }
                    }}
                    className={`px-5 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)] ${
                      c.sortable ? 'cursor-pointer select-none hover:text-[var(--text)]' : ''
                    }`}
                  >
                    {c.header}
                    {sortKey === c.key && <span className="ms-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visible.map((r) => (
                <tr key={getId(r)} className="hover:bg-[var(--bg-elevated)]/80">
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-3.5 text-[13px]">
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function omit(obj: Record<string, string>, key: string): Record<string, string> {
  const { [key]: _, ...rest } = obj;
  return rest;
}
