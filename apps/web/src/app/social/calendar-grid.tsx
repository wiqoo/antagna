import { StatusPill } from '@antagna/ui';

type Post = {
  id: string;
  title: string;
  code: string | null;
  plannedPublishAt: string;
  status: string;
};

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'accent' | 'success'> = {
  idea: 'neutral',
  editing: 'warning',
  scheduled: 'accent',
  published: 'success',
};

const WEEK_HEADER_AR = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const MONTH_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/** JS `Date#getDay()` returns 0(Sun)..6(Sat); we want Sat=0, Sun=1, ..., Fri=6. */
function colForJsDay(d: number) {
  return (d + 1) % 7;
}

/** Month grid (week starts Saturday) of scheduled content posts. Server component. */
export function CalendarGrid({ posts }: { posts: Post[] }) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based

  const firstOfMonth = new Date(Date.UTC(y, m, 1));
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const leading = colForJsDay(firstOfMonth.getUTCDay());

  // Bucket posts by YYYY-MM-DD.
  const byDate = new Map<string, Post[]>();
  for (const p of posts) {
    const key = p.plannedPublishAt.slice(0, 10);
    const arr = byDate.get(key);
    if (arr) arr.push(p);
    else byDate.set(key, [p]);
  }

  const cells: Array<{ day: number | null; iso: string | null; posts: Post[] }> = [];
  for (let i = 0; i < leading; i++) cells.push({ day: null, iso: null, posts: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso, posts: byDate.get(iso) ?? [] });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null, posts: [] });

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-baseline justify-between border-b border-[var(--line)] px-5 py-3">
        <div>
          <p className="text-[15px] font-semibold text-[var(--text)]">
            {MONTH_AR[m]} {y}
          </p>
          <p className="text-[11px] text-[var(--text-dim)]">
            {posts.length} منشور مجدول هذا الشهر
          </p>
        </div>
        <p className="font-mono text-[11px] text-[var(--text-dim)]" dir="ltr">
          {String(m + 1).padStart(2, '0')}/{y}
        </p>
      </div>

      <div
        className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--bg-elevated)] text-center"
        dir="rtl"
      >
        {WEEK_HEADER_AR.map((wh) => (
          <div
            key={wh}
            className="border-l border-[var(--line)] py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] last:border-l-0"
          >
            {wh}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7" dir="rtl">
        {cells.map((c, i) => {
          const isToday = c.iso === todayIso;
          const isOut = c.day === null;
          return (
            <div
              key={i}
              className={
                'min-h-[100px] border-b border-l border-[var(--line)] p-1.5 last:border-l-0 ' +
                (isOut
                  ? 'bg-[var(--bg-elevated)]/40'
                  : isToday
                    ? 'bg-[var(--accent)]/[0.06]'
                    : 'bg-[var(--surface)]')
              }
            >
              {c.day !== null && (
                <div className="flex items-start justify-between">
                  <span
                    className={
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ' +
                      (isToday
                        ? 'bg-[var(--accent)] text-black'
                        : 'text-[var(--text-muted)]')
                    }
                  >
                    {c.day}
                  </span>
                </div>
              )}
              {c.posts.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {c.posts.slice(0, 3).map((p) => (
                    <li key={p.id} className="truncate text-[10px] leading-tight">
                      <StatusPill
                        tone={STATUS_TONE[p.status] ?? 'neutral'}
                        withDot={false}
                      >
                        <span className="truncate">{p.title}</span>
                      </StatusPill>
                    </li>
                  ))}
                  {c.posts.length > 3 && (
                    <li className="text-[10px] text-[var(--text-dim)]">
                      +{c.posts.length - 3} المزيد
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
