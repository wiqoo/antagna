import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq, desc, and, gt, sql } from 'drizzle-orm';
import {
  db,
  aiSuggestions,
  emailThreads,
} from '@antagna/db';
import { PageHeader, Card, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { canAny } from '@/lib/authz';
import { Brain, Sparkles } from 'lucide-react';
import { SuggestionsList } from './suggestions-list';
import { RefreshButton } from './refresh-button';
import { cleanupSuggestions } from './actions';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  create_client: 'عميل جديد',
  create_contact: 'جهة اتصال',
  create_project: 'مشروع جديد',
  update_project: 'تحديث مشروع',
  create_task: 'مهمة',
  create_lead: 'فرصة',
  link_thread_to_project: 'ربط بمشروع',
  reply_draft: 'مسودة رد',
  escalate_to_human: 'تصعيد',
};

function dedupKey(type: string, pd: Record<string, unknown>): string | null {
  let v = '';
  if (type === 'create_client') v = String(pd.name_ar ?? '').toLowerCase().trim();
  else if (type === 'create_contact') v = String(pd.email ?? '').toLowerCase().trim();
  else if (type === 'create_project') v = String(pd.title ?? '').toLowerCase().trim();
  else return null;
  return v ? `${type}:${v}` : null;
}

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; cleaned?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const typeFilter = typeof sp.type === 'string' ? sp.type : null;
  const showAll = sp.all === '1';
  const cleaned = sp.cleaned ? Number(sp.cleaned) : null;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/inbox/suggestions');
  const canRead = await canAny(['email_threads.read.all', 'email_threads.read.assigned']);
  if (!canRead) redirect('/dashboard');

  // Void wrapper for the cleanup button → reject noise + dedupe, then redirect.
  async function cleanupAction(): Promise<void> {
    'use server';
    const res = await cleanupSuggestions();
    redirect(`/inbox/suggestions?cleaned=${res.ok ? res.noise + res.dupes : 0}`);
  }

  const rows = await db
    .select({
      id: aiSuggestions.id,
      suggestionType: aiSuggestions.suggestionType,
      proposedData: aiSuggestions.proposedData,
      summaryAr: aiSuggestions.summaryAr,
      confidence: aiSuggestions.confidence,
      createdAt: aiSuggestions.createdAt,
      sourceThreadId: aiSuggestions.sourceThreadId,
      threadSubject: emailThreads.subject,
    })
    .from(aiSuggestions)
    .leftJoin(emailThreads, eq(emailThreads.id, aiSuggestions.sourceThreadId))
    .where(and(eq(aiSuggestions.status, 'pending'), gt(aiSuggestions.expiresAt, new Date())))
    .orderBy(desc(aiSuggestions.confidence), desc(aiSuggestions.createdAt))
    .limit(300);

  // Breakdown by type (for the filter chips).
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.suggestionType, (byType.get(r.suggestionType) ?? 0) + 1);
  const total = rows.length;

  // De-duplicate (client/contact/project) + hide low-confidence task noise by
  // default; the type filter + "عرض الكل" override.
  const seen = new Set<string>();
  let dupes = 0;
  let noiseHidden = 0;
  const visible = rows.filter((r) => {
    if (typeFilter && r.suggestionType !== typeFilter) return false;
    const pd = (r.proposedData ?? {}) as Record<string, unknown>;
    const key = dedupKey(r.suggestionType, pd);
    if (key) {
      if (seen.has(key)) { dupes++; return false; }
      seen.add(key);
    }
    if (!showAll && !typeFilter && r.suggestionType === 'create_task' && Number(r.confidence) < 0.7) {
      noiseHidden++;
      return false;
    }
    return true;
  }).slice(0, 80);

  const TYPES = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/inbox">
      <Link href="/inbox" className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]">
        ← الوارد
      </Link>

      <PageHeader
        eyebrow="AI · Suggestions"
        title="اقتراحات الـ AI"
        subtitle={`${total} اقتراح معلّق من تحليل البريد — راجِع ووافق، أو نظّف الضوضاء والتكرار بضغطة.`}
        action={<RefreshButton />}
      />

      {cleaned != null && (
        <div className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-4 py-2.5 text-[13px] text-[var(--text)]">
          ✓ تم تنظيف {cleaned} اقتراح (ضوضاء + تكرار). الباقي اقتراحات فريدة تستحق المراجعة.
        </div>
      )}

      {/* Cleanup + filter bar */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/inbox/suggestions"
            className={'rounded-md px-2.5 py-1 text-[12px] font-medium ' + (!typeFilter ? 'bg-[var(--accent)] text-white' : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]')}
          >
            الكل ({total})
          </Link>
          {TYPES.map(([t, c]) => (
            <Link
              key={t}
              href={`/inbox/suggestions?type=${t}`}
              className={'rounded-md px-2.5 py-1 text-[12px] font-medium ' + (typeFilter === t ? 'bg-[var(--accent)] text-white' : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]')}
            >
              {TYPE_LABEL[t] ?? t} ({c})
            </Link>
          ))}
        </div>
        <form action={cleanupAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
          >
            <Sparkles size={13} /> نظّف الضوضاء والتكرار
          </button>
        </form>
      </Card>

      {(dupes > 0 || noiseHidden > 0) && (
        <p className="-mt-2 text-[11px] text-[var(--text-dim)]">
          مخفي تلقائياً: {dupes > 0 ? `${dupes} مكرّر` : ''}{dupes > 0 && noiseHidden > 0 ? ' · ' : ''}{noiseHidden > 0 ? `${noiseHidden} مهمة ضعيفة الثقة` : ''}.
          {' '}
          <Link href="/inbox/suggestions?all=1" className="text-[var(--accent)] hover:underline">عرض الكل</Link>
        </p>
      )}

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Brain size={20} />}
            title={total === 0 ? 'لا اقتراحات معلّقة' : 'لا شيء بعد الفلترة'}
            description={total === 0 ? 'عند وصول إيميلات جديدة، سيقترح الـ AI إجراءات هنا.' : 'غيّر الفلتر أو اضغط «عرض الكل».'}
          />
        </Card>
      ) : (
        <SuggestionsList
          items={visible.map((r) => ({
            id: r.id,
            type: r.suggestionType,
            typeLabel: TYPE_LABEL[r.suggestionType] ?? r.suggestionType,
            summary: r.summaryAr,
            confidence: Number(r.confidence),
            proposedData: r.proposedData as Record<string, unknown>,
            threadSubject: r.threadSubject ?? null,
            threadId: r.sourceThreadId ?? null,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          }))}
        />
      )}
    </Shell>
  );
}
