import { fmtNum } from './_shared';

export interface DayBar {
  /** YYYY-MM-DD */
  day: string;
  value: number;
}

/**
 * Lightweight time-series bar chart built from divs (no chart library).
 * Server component. Bars scale to the max value in the series.
 */
export function AnalyticsBars({
  series,
  label,
  accent = 'var(--accent)',
  unit,
}: {
  series: DayBar[];
  label: string;
  accent?: string;
  unit?: string;
}) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const total = series.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-[var(--text)]">{label}</p>
        <p className="font-mono text-[12px] text-[var(--text-muted)] tabular">
          {fmtNum(total)} {unit ? <span className="text-[var(--text-dim)]">{unit}</span> : null}
        </p>
      </div>
      {series.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-[var(--text-dim)]">لا توجد لقطات بعد.</p>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height: 140 }}>
          {series.map((d) => {
            const h = Math.max(3, Math.round((d.value / max) * 128));
            const dayNum = d.day.slice(8, 10);
            return (
              <div key={d.day} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[9px] tabular text-[var(--text-dim)] opacity-0 transition-opacity group-hover:opacity-100">
                  {fmtNum(d.value)}
                </span>
                <div
                  className="w-full rounded-t-[3px] transition-all"
                  style={{ height: h, background: accent, opacity: 0.85 }}
                  title={`${d.day}: ${fmtNum(d.value)}`}
                />
                <span className="text-[9px] tabular text-[var(--text-dim)]" dir="ltr">
                  {dayNum}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
