import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, feedback, profiles } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatBox, StatusPill, Avatar, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, MessageSquare, Bug, Lightbulb, Sparkles, Inbox } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { setFeedbackStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  open: 'warning',
  in_review: 'info',
  resolved: 'success',
  dismissed: 'neutral',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'مفتوح',
  in_review: 'قيد المراجعة',
  resolved: 'محلول',
  dismissed: 'مرفوض',
};

const CATEGORY_LABEL: Record<string, string> = {
  bug: 'خلل',
  feature: 'ميزة',
  ux: 'تجربة',
  general: 'عام',
};
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  bug: <Bug size={13} />,
  feature: <Lightbulb size={13} />,
  ux: <Sparkles size={13} />,
  general: <MessageSquare size={13} />,
};

// The status the toggle button moves a row TO, given its current status.
const NEXT_ACTIONS: { status: string; label: string }[] = [
  { status: 'in_review', label: 'مراجعة' },
  { status: 'resolved', label: 'حلّ' },
  { status: 'dismissed', label: 'رفض' },
  { status: 'open', label: 'إعادة فتح' },
];

export default async function FeedbackAdminPage() {
  await requirePermission('access.manage');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const items = await db
    .select({
      id: feedback.id,
      category: feedback.category,
      message: feedback.message,
      status: feedback.status,
      createdAt: feedback.createdAt,
      authorName: profiles.displayName,
    })
    .from(feedback)
    .leftJoin(profiles, eq(profiles.id, feedback.profileId))
    .orderBy(desc(feedback.createdAt))
    .limit(200);

  const openCount = items.filter((i) => i.status === 'open').length;
  const reviewCount = items.filter((i) => i.status === 'in_review').length;
  const resolvedCount = items.filter((i) => i.status === 'resolved').length;

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · النظام"
        title="صندوق الملاحظات"
        subtitle="ملاحظات الفريق والأخطاء وطلبات الميزات — افرزها وحرّك حالتها حتى الإغلاق."
      />

      {items.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Inbox size={20} />}
            title="لا ملاحظات بعد"
            description="ستظهر هنا ملاحظات الفريق والأخطاء وطلبات الميزات حين تُرسَل. الصندوق فارغ حالياً."
          />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatBox label="مفتوح" value={openCount} icon={<Inbox size={16} />} tone={openCount > 0 ? 'warning' : 'default'} />
            <StatBox label="قيد المراجعة" value={reviewCount} icon={<MessageSquare size={16} />} />
            <StatBox label="محلول" value={resolvedCount} icon={<Sparkles size={16} />} tone={resolvedCount > 0 ? 'success' : 'default'} />
          </section>

          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader title="الملاحظات" subtitle={`${items.length} عنصر`} />
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {items.map((it) => {
                const cat = it.category ?? 'general';
                return (
                  <li key={it.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                            {CATEGORY_ICON[cat] ?? CATEGORY_ICON.general}
                            {CATEGORY_LABEL[cat] ?? cat}
                          </span>
                          <StatusPill tone={STATUS_TONE[it.status] ?? 'neutral'} withDot={false}>
                            {STATUS_LABEL[it.status] ?? it.status}
                          </StatusPill>
                          <span className="font-mono text-[10px] text-[var(--text-dim)]">
                            {new Date(it.createdAt).toISOString().slice(0, 10)}
                          </span>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text)]">
                          {it.message}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                          <Avatar name={it.authorName ?? 'مجهول'} size="sm" />
                          <span>{it.authorName ?? 'مجهول'}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {NEXT_ACTIONS.filter((a) => a.status !== it.status).map((a) => (
                          <form key={a.status} action={setFeedbackStatus}>
                            <input type="hidden" name="id" value={it.id} />
                            <input type="hidden" name="status" value={a.status} />
                            <button
                              type="submit"
                              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            >
                              {a.label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </Shell>
  );
}
