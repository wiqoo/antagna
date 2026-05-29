import { redirect } from 'next/navigation';
import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db, activityEvents, profiles, projects } from '@antagna/db';
import { PageHeader, Card, EmptyState, Avatar, StatusPill } from '@antagna/ui';
import {
  History,
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  CheckCircle2,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Static product changelog — curated release notes. Lives in code so it ships
 * with the deploy. Newest first. Activity below is the live system feed. */
const RELEASES: {
  version: string;
  date: string;
  tone: 'success' | 'info' | 'neutral';
  items: string[];
}[] = [
  {
    version: 'Sprint 0 — الصلاحيات',
    date: '2026-05-29',
    tone: 'success',
    items: [
      'إعادة بناء نظام الصلاحيات: 16 منصب + صلاحيات افتراضية لكل منصب.',
      'عرض كـ (View-as) لمحاكاة صلاحيات أي عضو في الفريق.',
      'حجب الحقول الحسّاسة عبر طبقات العرض الآمنة (v_*_safe).',
      'دعوات بالبريد فقط مع بوابة تسجيل ذاتي.',
    ],
  },
  {
    version: 'الوارد + البحث',
    date: '2026-05-28',
    tone: 'info',
    items: [
      'صفحة تفاصيل لكل محادثة في الوارد مع ملخّص AI والخطوات التالية.',
      'بحث شامل عبر النظام من صفحة /search ومن لوحة ⌘K.',
      'إضافة الحضور و WhatsApp إلى شريط التنقّل.',
    ],
  },
  {
    version: 'المعدات + العملاء',
    date: '2026-05-27',
    tone: 'neutral',
    items: [
      'كتالوج المعدات (172 وحدة) مع الحجوزات والصيانة والكيتات ومسح QR.',
      'إنشاء عميل مع توليد كود تلقائي واختيار العلامة الفرعية والقطاع.',
    ],
  },
];

const ACTION_META: Record<string, { icon: LucideIcon; tone: string }> = {
  created: { icon: Plus, tone: 'var(--success)' },
  updated: { icon: Pencil, tone: 'var(--accent)' },
  deleted: { icon: Trash2, tone: 'var(--danger)' },
  archived: { icon: Trash2, tone: 'var(--text-dim)' },
  state_changed: { icon: ArrowRightLeft, tone: 'var(--warning)' },
  transitioned: { icon: ArrowRightLeft, tone: 'var(--warning)' },
  approved: { icon: CheckCircle2, tone: 'var(--success)' },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { icon: Activity, tone: 'var(--text-dim)' };
}

const DATE_FMT = new Intl.DateTimeFormat('ar', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const TIME_FMT = new Intl.DateTimeFormat('ar', {
  hour: '2-digit',
  minute: '2-digit',
});

export default async function ChangelogPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/changelog');

  const events = await db
    .select({
      id: activityEvents.id,
      action: activityEvents.action,
      entityType: activityEvents.entityType,
      summaryAr: activityEvents.summaryAr,
      summaryEn: activityEvents.summaryEn,
      createdAt: activityEvents.createdAt,
      actorName: profiles.displayName,
      projectId: activityEvents.projectId,
      projectCode: projects.code,
      projectTitle: projects.title,
      projectTitleAr: projects.titleAr,
    })
    .from(activityEvents)
    .leftJoin(profiles, eq(profiles.id, activityEvents.actorId))
    .leftJoin(projects, eq(projects.id, activityEvents.projectId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(120);

  // Group activity by calendar day for a clean timeline.
  const days = new Map<string, typeof events>();
  for (const e of events) {
    const key = new Date(e.createdAt).toISOString().slice(0, 10);
    const arr = days.get(key) ?? [];
    arr.push(e);
    days.set(key, arr);
  }
  const dayKeys = Array.from(days.keys());

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/changelog">
      <PageHeader
        eyebrow="Antagna · السجل"
        title="سجل التغييرات والنشاط"
        subtitle="إصدارات المنتج المنشورة، وآخر نشاط على مستوى النظام بالكامل."
      />

      {/* ── Releases (static) ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <header className="flex items-center gap-2">
          <p className="section-rule" style={{ minWidth: 120 }}>
            إصدارات المنتج
          </p>
        </header>
        <div className="space-y-px stagger-in">
          {RELEASES.map((rel) => (
            <Card key={rel.version}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[15px] font-semibold text-[var(--text)]">
                      {rel.version}
                    </h3>
                    <StatusPill
                      tone={
                        rel.tone === 'success'
                          ? 'success'
                          : rel.tone === 'info'
                            ? 'info'
                            : 'neutral'
                      }
                    >
                      جديد
                    </StatusPill>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--text-dim)]">
                    {rel.date}
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {rel.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--text-muted)]"
                  >
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/60" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Live system activity (activity_events) ────────────────────────── */}
      <section className="space-y-4">
        <header className="flex items-end justify-between gap-4">
          <p className="section-rule" style={{ minWidth: 140 }}>
            نشاط النظام
          </p>
          <span className="text-[11px] text-[var(--text-muted)]">
            {events.length > 0 ? `آخر ${events.length} حدث` : 'مباشر'}
          </span>
        </header>

        {events.length === 0 ? (
          <Card>
            <EmptyState
              icon={<History size={18} />}
              title="لا نشاط بعد"
              description="سيظهر هنا كل ما يحدث في النظام — إنشاء المشاريع، تغيير الحالات، الاعتمادات، تعديلات العملاء والمعدات — لحظة حدوثه."
            />
          </Card>
        ) : (
          <div className="space-y-8">
            {dayKeys.map((key) => {
              const list = days.get(key)!;
              const dayLabel = DATE_FMT.format(new Date(`${key}T00:00:00Z`));
              return (
                <div key={key} className="space-y-3">
                  <h3 className="sticky top-0 z-[1] bg-[var(--bg)]/85 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)] backdrop-blur">
                    {dayLabel}
                  </h3>
                  <ol className="relative space-y-px border-s border-[var(--line)] ps-5">
                    {list.map((e) => {
                      const meta = actionMeta(e.action);
                      const Icon = meta.icon;
                      const summary =
                        e.summaryAr || e.summaryEn || `${e.action} · ${e.entityType}`;
                      const time = TIME_FMT.format(new Date(e.createdAt));
                      return (
                        <li
                          key={String(e.id)}
                          className="relative -ms-5 flex items-start gap-3 rounded-md py-2.5 ps-5 pe-3 hover:bg-[var(--surface-hover)]"
                        >
                          <span
                            className="absolute start-[-7px] top-3.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-elevated)]"
                            style={{ color: meta.tone }}
                          >
                            <Icon size={9} />
                          </span>
                          <Avatar name={e.actorName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug text-[var(--text)]">
                              {e.actorName && (
                                <span className="font-medium">{e.actorName} </span>
                              )}
                              <span className="text-[var(--text-muted)]">{summary}</span>
                            </p>
                            <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                              <span className="font-mono tabular">{time}</span>
                              <span className="uppercase tracking-[0.14em]">
                                {e.entityType}
                              </span>
                              {e.projectId && (
                                <Link
                                  href={`/projects/${e.projectId}`}
                                  className="truncate hover:text-[var(--accent)]"
                                >
                                  · <span className="font-mono">{e.projectCode}</span>{' '}
                                  {e.projectTitleAr ?? e.projectTitle}
                                </Link>
                              )}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Changelog</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
