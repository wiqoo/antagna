import Link from 'next/link';
import { requireOwner } from '../auth';
import { getCalItems, kindMeta, type CalItem } from '../calendar';
import { createEvent, deleteEvent } from '../actions4';
import { todayRiyadh } from '../data';

export const dynamic = 'force-dynamic';

const KINDS = [
  { value: 'shoot', label: '🎥 تصوير' }, { value: 'meeting', label: '👥 اجتماع' },
  { value: 'deep', label: '🎯 تركيز' }, { value: 'admin', label: '🗂️ إداري' },
  { value: 'personal', label: '🌿 شخصي' }, { value: 'event', label: '📌 موعد' },
];

function dayHeader(date: string, today: string): string {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  if (date === today) return 'النهارده · ' + label;
  const tmr = new Date(today + 'T00:00:00'); tmr.setDate(tmr.getDate() + 1);
  if (date === tmr.toISOString().slice(0, 10)) return 'بكرة · ' + label;
  return label;
}

export default async function CalendarPage() {
  const me = await requireOwner();
  const today = todayRiyadh();
  const end = new Date(today + 'T00:00:00'); end.setDate(end.getDate() + 13);
  const items = await getCalItems(me.profileId, today, end.toISOString().slice(0, 10));

  const byDay = new Map<string, CalItem[]>();
  for (const it of items) { const a = byDay.get(it.date) ?? []; a.push(it); byDay.set(it.date, a); }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[20px] font-bold">📅 الكالندر</h1>
        <Link href="/me" className="text-[12px] text-[var(--text-dim)]">← اليوم</Link>
      </div>

      <details className="mb-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-[var(--accent)]">+ موعد جديد</summary>
        <form action={createEvent} className="mt-3 flex flex-col gap-2.5">
          <input name="title" required placeholder="عنوان الموعد" className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]" />
          <div className="flex gap-2">
            <input type="date" name="date" defaultValue={today} required className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
            <select name="kind" className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="time" name="time" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
            <span className="text-[var(--text-dim)]">→</span>
            <input type="time" name="end_time" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
          </div>
          <input name="location" placeholder="المكان (اختياري)" className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
          <button className="rounded-xl bg-[var(--accent)] py-2.5 text-[14px] font-semibold text-[#1a1a1a]">إضافة</button>
        </form>
      </details>

      {byDay.size === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-[13px] text-[var(--text-dim)]">
          مفيش مواعيد في الأسبوعين الجايين ✨
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...byDay.entries()].map(([date, dayItems]) => (
            <section key={date}>
              <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">{dayHeader(date, today)}</h2>
              <div className="flex flex-col gap-1.5">
                {dayItems.map((e) => {
                  const km = kindMeta(e.kind);
                  return (
                    <div key={e.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                      <span className="w-[42px] shrink-0 text-right text-[11px] tabular-nums text-[var(--text-dim)]">{e.allDay ? '—' : e.startHm}</span>
                      <span className="h-8 w-0.5 shrink-0 rounded" style={{ background: km.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px]">{km.icon} {e.title}</p>
                        {(e.location || e.project) && <p className="text-[10.5px] text-[var(--text-dim)]">{[e.project, e.location].filter(Boolean).join(' · ')}</p>}
                      </div>
                      {e.source === 'manual' ? (
                        <form action={deleteEvent.bind(null, e.ref)}>
                          <button className="shrink-0 px-1 text-[13px] text-[var(--text-dim)]">✕</button>
                        </form>
                      ) : (
                        <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[9.5px] text-[var(--text-dim)]">انتجنا</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
