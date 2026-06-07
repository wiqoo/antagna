import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, EmptyState, AIHints, type AIHint } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import {
  Calendar, ChevronRight, ChevronLeft, CalendarDays, Rows3, LayoutGrid,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageLabelAr } from '@/lib/project-stage';
import { listGoogleEvents } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

type View = 'month' | 'week' | 'agenda';
type Tone = 'accent' | 'warning' | 'info' | 'google';

type Ev = {
  date: string;        // YYYY-MM-DD bucket
  time: string | null; // HH:MM if timed
  kind: 'shoot' | 'delivery' | 'reservation' | 'google';
  title: string;
  sub: string | null;
  href: string | null;
  extHref?: string | null;
  tone: Tone;
};

const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const TONE_DOT: Record<Tone, string> = {
  accent: 'var(--accent)',
  warning: 'var(--warning)',
  info: 'var(--info,#5b9dd9)',
  google: '#4285F4',
};
const TONE_BORDER: Record<Tone, string> = {
  accent: 'border-[var(--accent)]/30 bg-[var(--accent)]/[0.05]',
  warning: 'border-[var(--warning)]/30 bg-[var(--warning)]/[0.05]',
  info: 'border-[var(--line)] bg-[var(--bg-elevated)]/40',
  google: 'border-[#4285F4]/30 bg-[#4285F4]/[0.06]',
};

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86_400_000); }
function parseAnchor(s?: string): Date {
  const d = s ? new Date(`${s}T00:00:00Z`) : new Date();
  const out = isNaN(d.getTime()) ? new Date() : d;
  out.setUTCHours(0, 0, 0, 0);
  return out;
}
function startOfWeek(d: Date) { return addDays(d, -d.getUTCDay()); }
function startOfMonth(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; anchor?: string }>;
}) {
  const sp = await searchParams;
  const view: View = sp.view === 'week' ? 'week' : sp.view === 'agenda' ? 'agenda' : 'month';
  const anchor = parseAnchor(sp.anchor);

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/calendar');

  const todayIso = ymd(parseAnchor());

  // Range per view.
  let rangeStart: Date;
  let rangeEnd: Date; // exclusive
  if (view === 'month') {
    rangeStart = startOfWeek(startOfMonth(anchor));
    rangeEnd = addDays(rangeStart, 42);
  } else if (view === 'week') {
    rangeStart = startOfWeek(anchor);
    rangeEnd = addDays(rangeStart, 7);
  } else {
    rangeStart = anchor;
    rangeEnd = addDays(anchor, 30);
  }
  const startISO = ymd(rangeStart);
  const endISO = ymd(rangeEnd);

  const [shootsRes, deliveriesRes, reservationsRes, gcal] = await Promise.all([
    db.execute<{ project_id: string; project_code: string; project_title: string; title_ar: string | null; stage: string; shoot_starts: Date | null; shoot_ends: Date | null; client: string | null }>(sql`
      SELECT p.id::text AS project_id, p.code AS project_code, p.title AS project_title, p.title_ar,
             p.stage::text AS stage, p.shoot_starts_at AS shoot_starts, p.shoot_ends_at AS shoot_ends,
             c.name_ar AS client
      FROM projects p LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.archived_at IS NULL AND (
        (p.shoot_starts_at >= ${startISO}::date AND p.shoot_starts_at < ${endISO}::date) OR
        (p.shoot_ends_at   >= ${startISO}::date AND p.shoot_ends_at   < ${endISO}::date))
    `),
    db.execute<{ project_id: string; project_code: string; project_title: string; title_ar: string | null; stage: string; delivery_due: Date; client: string | null }>(sql`
      SELECT p.id::text AS project_id, p.code AS project_code, p.title AS project_title, p.title_ar,
             p.stage::text AS stage, p.delivery_due_at AS delivery_due, c.name_ar AS client
      FROM projects p LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.archived_at IS NULL AND p.delivery_due_at >= ${startISO}::date AND p.delivery_due_at < ${endISO}::date
    `),
    db.execute<{ id: string; starts_at: Date; ends_at: Date; eq_code: string | null; eq_model: string | null; project_code: string | null; project_id: string | null }>(sql`
      SELECT r.id::text AS id, r.starts_at, r.ends_at, e.code AS eq_code, e.model AS eq_model,
             p.code AS project_code, p.id::text AS project_id
      FROM equipment_reservations r
      LEFT JOIN equipment e ON e.id = r.equipment_id
      LEFT JOIN projects p ON p.id = r.project_id
      WHERE r.starts_at < ${endISO}::date AND r.ends_at >= ${startISO}::date AND r.status != 'cancelled'
      ORDER BY r.starts_at
    `),
    listGoogleEvents(`${startISO}T00:00:00Z`, `${endISO}T00:00:00Z`),
  ]);

  // Build unified event map by date.
  const evMap = new Map<string, Ev[]>();
  const push = (e: Ev) => {
    const arr = evMap.get(e.date);
    if (arr) arr.push(e); else evMap.set(e.date, [e]);
  };

  for (const s of shootsRes as unknown as Array<{ project_id: string; project_code: string; project_title: string; title_ar: string | null; stage: string; shoot_starts: Date | null; shoot_ends: Date | null; client: string | null }>) {
    if (s.shoot_starts) push({ date: ymd(new Date(s.shoot_starts)), time: null, kind: 'shoot', title: `تصوير: ${s.title_ar ?? s.project_title}`, sub: s.client ?? s.project_code, href: `/projects/${s.project_id}`, tone: 'accent' });
    if (s.shoot_ends) push({ date: ymd(new Date(s.shoot_ends)), time: null, kind: 'shoot', title: `نهاية تصوير: ${s.title_ar ?? s.project_title}`, sub: s.client ?? s.project_code, href: `/projects/${s.project_id}`, tone: 'accent' });
  }
  for (const d of deliveriesRes as unknown as Array<{ project_id: string; project_code: string; project_title: string; title_ar: string | null; stage: string; delivery_due: Date; client: string | null }>) {
    push({ date: ymd(new Date(d.delivery_due)), time: null, kind: 'delivery', title: `تسليم: ${d.title_ar ?? d.project_title}`, sub: `${d.project_code}${d.client ? ` · ${d.client}` : ''} · ${stageLabelAr(d.stage)}`, href: `/projects/${d.project_id}`, tone: 'warning' });
  }
  for (const r of reservationsRes as unknown as Array<{ id: string; starts_at: Date; ends_at: Date; eq_code: string | null; eq_model: string | null; project_code: string | null; project_id: string | null }>) {
    push({ date: ymd(new Date(r.starts_at)), time: new Date(r.starts_at).toISOString().slice(11, 16), kind: 'reservation', title: r.eq_code ? `حجز: ${r.eq_code} ${r.eq_model ?? ''}` : 'حجز مجموعة معدات', sub: r.project_code, href: r.project_id ? `/projects/${r.project_id}` : null, tone: 'info' });
  }
  for (const g of gcal.events) {
    if (!g.startIso) continue;
    push({ date: g.startIso.slice(0, 10), time: g.allDay ? null : g.startIso.slice(11, 16), kind: 'google', title: g.title, sub: g.location, href: null, extHref: g.htmlLink, tone: 'google' });
  }

  // sort each day's events by time
  for (const arr of evMap.values()) arr.sort((a, b) => (a.time ?? '99') < (b.time ?? '99') ? -1 : 1);

  const totalEvents = Array.from(evMap.values()).reduce((s, a) => s + a.length, 0);
  const shootCount = Array.from(evMap.values()).flat().filter((e) => e.kind === 'shoot').length;
  const deliveryCount = Array.from(evMap.values()).flat().filter((e) => e.kind === 'delivery').length;
  const gcalCount = gcal.events.length;

  // ── AI hints (grounded in the real schedule) ──────────────────────────────
  const hints: AIHint[] = [];
  const todayEvents = evMap.get(todayIso) ?? [];
  const todayShoots = todayEvents.filter((e) => e.kind === 'shoot').length;
  if (todayShoots > 0) {
    hints.push({ index: '01', text: `اليوم: ${todayShoots} تصوير`, insight: 'تأكّد من جاهزية المعدّات والفريق قبل ساعتين من كل جلسة.', urgent: true });
  }
  // equipment double-booking
  let conflictDays = 0;
  for (const [, arr] of evMap) {
    const codes = new Map<string, number>();
    for (const e of arr) if (e.kind === 'reservation' && e.title.startsWith('حجز: ')) codes.set(e.title, (codes.get(e.title) ?? 0) + 1);
    if (Array.from(codes.values()).some((n) => n > 1)) conflictDays++;
  }
  if (conflictDays > 0) {
    hints.push({ index: String(hints.length + 1).padStart(2, '0'), text: `${conflictDays} يوم فيه تعارض حجز معدّة`, insight: 'نفس المعدّة محجوزة مرتين في نفس اليوم — راجِع الأولوية.', urgent: true, actions: [{ label: 'افحص المعدات', href: '/equipment', primary: true }] });
  }
  // shoot day with no equipment reserved
  let shootNoGear = 0;
  for (const [, arr] of evMap) {
    const hasShoot = arr.some((e) => e.kind === 'shoot');
    const hasGear = arr.some((e) => e.kind === 'reservation');
    if (hasShoot && !hasGear) shootNoGear++;
  }
  if (shootNoGear > 0 && hints.length < 4) {
    hints.push({ index: String(hints.length + 1).padStart(2, '0'), text: `${shootNoGear} يوم تصوير بدون حجز معدّات`, insight: 'احجز المعدّات مبكراً لتفادي التعارض يوم التصوير.', actions: [{ label: 'احجز معدّات', href: '/equipment' }] });
  }
  if (deliveryCount >= 3 && hints.length < 4) {
    hints.push({ index: String(hints.length + 1).padStart(2, '0'), text: `${deliveryCount} تسليم في هذه الفترة`, insight: 'كثافة عالية — وزّع الجداول حتى لا يتراكم اليوم الأخير.', actions: [{ label: 'اعرض المشاريع', href: '/projects' }] });
  }
  if (!gcal.connected && hints.length < 4) {
    hints.push({ index: String(hints.length + 1).padStart(2, '0'), text: 'Google Calendar غير مربوط', insight: 'اربط حساب Google لعرض اجتماعاتك بجانب جدول الإنتاج.', actions: [{ label: 'الإعدادات', href: '/admin' }] });
  }

  // ── navigation ────────────────────────────────────────────────────────────
  const navPrev = view === 'month'
    ? ymd(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1)))
    : ymd(addDays(anchor, view === 'week' ? -7 : -30));
  const navNext = view === 'month'
    ? ymd(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1)))
    : ymd(addDays(anchor, view === 'week' ? 7 : 30));

  const periodLabel = view === 'month'
    ? `${MONTHS_AR[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`
    : view === 'week'
      ? `أسبوع ${ymd(rangeStart).slice(5)} → ${ymd(addDays(rangeStart, 6)).slice(5)}`
      : `${ymd(rangeStart).slice(5)} → ${ymd(addDays(rangeEnd, -1)).slice(5)}`;

  const VIEWS: Array<{ key: View; label: string; Icon: typeof LayoutGrid }> = [
    { key: 'month', label: 'شهر', Icon: LayoutGrid },
    { key: 'week', label: 'أسبوع', Icon: CalendarDays },
    { key: 'agenda', label: 'قائمة', Icon: Rows3 },
  ];

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/calendar">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · التقويم"
          headline={`${shootCount} تصوير · ${deliveryCount} تسليم${gcalCount ? ` · ${gcalCount} من Google` : ''}`}
          hints={hints}
          compact
        />
      )}

      <PageHeader
        eyebrow="Calendar"
        title="التقويم"
        subtitle={`تصوير · تسليم · حجوزات${gcal.connected ? ' · Google Calendar' : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
              {VIEWS.map((v) => (
                <Link
                  key={v.key}
                  href={`/calendar?view=${v.key}&anchor=${ymd(anchor)}`}
                  className={'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ' + (view === v.key ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}
                >
                  <v.Icon size={13} /> {v.label}
                </Link>
              ))}
            </div>
            <div className="inline-flex items-center gap-1">
              <Link href={`/calendar?view=${view}&anchor=${navPrev}`} className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"><ChevronRight size={15} /></Link>
              <Link href={`/calendar?view=${view}&anchor=${todayIso}`} className="inline-flex h-9 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">اليوم</Link>
              <Link href={`/calendar?view=${view}&anchor=${navNext}`} className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"><ChevronLeft size={15} /></Link>
            </div>
          </div>
        }
      />

      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[var(--text)]">{periodLabel}</h2>
        <span className="text-[11px] text-[var(--text-dim)]">{totalEvents} حدث</span>
      </div>

      {view === 'month' && <MonthView rangeStart={rangeStart} anchorMonth={anchor.getUTCMonth()} todayIso={todayIso} evMap={evMap} />}
      {view === 'week' && <WeekView rangeStart={rangeStart} todayIso={todayIso} evMap={evMap} />}
      {view === 'agenda' && <AgendaView rangeStart={rangeStart} rangeEnd={rangeEnd} todayIso={todayIso} evMap={evMap} />}
    </Shell>
  );
}

// ── chips & cells ─────────────────────────────────────────────────────────────

function EvChip({ e, compact }: { e: Ev; compact?: boolean }) {
  const inner = (
    <span className={'flex items-center gap-1.5 ' + (compact ? '' : 'rounded-md border px-2 py-1 ' + TONE_BORDER[e.tone])}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_DOT[e.tone] }} />
      {e.time && <span className="shrink-0 font-mono text-[9px] text-[var(--text-dim)]">{e.time}</span>}
      <span className={'truncate ' + (compact ? 'text-[10px] text-[var(--text-muted)]' : 'text-[12px] text-[var(--text)]')}>{e.title}</span>
    </span>
  );
  if (e.href) return <Link href={e.href} className="block min-w-0 hover:opacity-80">{inner}</Link>;
  if (e.extHref) return <a href={e.extHref} target="_blank" rel="noopener noreferrer" className="block min-w-0 hover:opacity-80">{inner}</a>;
  return <span className="block min-w-0">{inner}</span>;
}

function MonthView({ rangeStart, anchorMonth, todayIso, evMap }: { rangeStart: Date; anchorMonth: number; todayIso: string; evMap: Map<string, Ev[]> }) {
  const cells = Array.from({ length: 42 }, (_, i) => addDays(rangeStart, i));
  return (
    <Card padded={false}>
      <div className="grid grid-cols-7 border-b border-[var(--line)] text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {WEEKDAYS_AR.map((w) => <div key={w} className="py-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const iso = ymd(d);
          const evs = evMap.get(iso) ?? [];
          const inMonth = d.getUTCMonth() === anchorMonth;
          const isToday = iso === todayIso;
          const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
          return (
            <div key={iso} className={'min-h-[96px] border-b border-e border-[var(--line)] p-1.5 ' + ((i + 1) % 7 === 0 ? 'border-e-0 ' : '') + (inMonth ? '' : 'opacity-40 ') + (isToday ? 'bg-[var(--accent)]/[0.05]' : isWeekend ? 'bg-[var(--surface)]/20' : '')}>
              <div className={'mb-1 text-end font-mono text-[11px] ' + (isToday ? 'font-bold text-[var(--accent)]' : 'text-[var(--text-dim)]')}>{d.getUTCDate()}</div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e, j) => <EvChip key={j} e={e} compact />)}
                {evs.length > 3 && (
                  <Link href={`/calendar?view=agenda&anchor=${iso}`} className="block text-[9px] text-[var(--text-dim)] hover:text-[var(--accent)]">+{evs.length - 3} المزيد</Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({ rangeStart, todayIso, evMap }: { rangeStart: Date; todayIso: string; evMap: Map<string, Ev[]> }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-7">
      {days.map((d) => {
        const iso = ymd(d);
        const evs = evMap.get(iso) ?? [];
        const isToday = iso === todayIso;
        return (
          <Card key={iso} padded={false} className={isToday ? 'border-[var(--accent)]/40' : undefined}>
            <div className={'border-b border-[var(--line)] px-3 py-2 ' + (isToday ? 'text-[var(--accent)]' : '')}>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{WEEKDAYS_AR[d.getUTCDay()]}</p>
              <p className="font-mono text-[18px] font-bold leading-none">{d.getUTCDate()}</p>
            </div>
            <div className="space-y-1 p-2">
              {evs.length === 0 ? <p className="py-2 text-center text-[10px] text-[var(--text-dim)]">—</p> : evs.map((e, j) => <EvChip key={j} e={e} />)}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AgendaView({ rangeStart, rangeEnd, todayIso, evMap }: { rangeStart: Date; rangeEnd: Date; todayIso: string; evMap: Map<string, Ev[]> }) {
  const days: Date[] = [];
  for (let d = new Date(rangeStart); d < rangeEnd; d = addDays(d, 1)) days.push(new Date(d));
  const nonEmpty = days.filter((d) => (evMap.get(ymd(d)) ?? []).length > 0);
  if (nonEmpty.length === 0) {
    return <Card><EmptyState icon={<Calendar size={18} />} title="لا أحداث في هذه الفترة" description="أضِف موعد تصوير/تسليم على مشروع، أو اربط Google Calendar." /></Card>;
  }
  return (
    <Card padded={false}>
      <div className="divide-y divide-[var(--line)]">
        {nonEmpty.map((d) => {
          const iso = ymd(d);
          const evs = evMap.get(iso) ?? [];
          const isToday = iso === todayIso;
          return (
            <div key={iso} className={'grid grid-cols-[72px_1fr] gap-4 px-3 py-3 ' + (isToday ? 'bg-[var(--accent)]/[0.03]' : '')}>
              <div>
                <p className={'text-[10px] uppercase tracking-wider ' + (isToday ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]')}>{isToday ? 'اليوم' : WEEKDAYS_AR[d.getUTCDay()]}</p>
                <p className="font-mono text-[28px] font-bold leading-none text-[var(--text)]">{d.getUTCDate()}</p>
                <p className="text-[9px] text-[var(--text-dim)]">{MONTHS_AR[d.getUTCMonth()]}</p>
              </div>
              <div className="space-y-1.5 py-1">{evs.map((e, j) => <EvChip key={j} e={e} />)}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
