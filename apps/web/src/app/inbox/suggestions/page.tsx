import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq, desc, and, gt, sql } from 'drizzle-orm';
import {
  db,
  aiSuggestions,
  emailThreads,
  emailMessages,
} from '@antagna/db';
import { PageHeader, Card, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getAdminUser } from '@/lib/auth-admin';
import { Brain, Mail } from 'lucide-react';
import { SuggestionsList } from './suggestions-list';
import { RefreshButton } from './refresh-button';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  create_client: 'عميل جديد',
  create_contact: 'جهة اتصال جديدة',
  create_project: 'مشروع جديد',
  update_project: 'تحديث مشروع',
  create_task: 'مهمة جديدة',
  create_lead: 'Lead جديد',
  link_thread_to_project: 'ربط بمشروع',
  reply_draft: 'مسودة رد',
  escalate_to_human: 'تصعيد',
};

export default async function SuggestionsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/inbox/suggestions');

  const rows = await db
    .select({
      id: aiSuggestions.id,
      suggestionType: aiSuggestions.suggestionType,
      proposedData: aiSuggestions.proposedData,
      summaryAr: aiSuggestions.summaryAr,
      confidence: aiSuggestions.confidence,
      status: aiSuggestions.status,
      createdAt: aiSuggestions.createdAt,
      sourceThreadId: aiSuggestions.sourceThreadId,
      threadSubject: emailThreads.subject,
    })
    .from(aiSuggestions)
    .leftJoin(emailThreads, eq(emailThreads.id, aiSuggestions.sourceThreadId))
    .where(
      and(
        eq(aiSuggestions.status, 'pending'),
        gt(aiSuggestions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(aiSuggestions.confidence), desc(aiSuggestions.createdAt))
    .limit(50);

  const stats = await db.execute<{ status: string; n: number }>(sql`
    SELECT status::text AS status, count(*)::int AS n
    FROM ai_suggestions
    GROUP BY status
  `);
  const statMap = Object.fromEntries(
    (stats as unknown as { status: string; n: number }[]).map((r) => [r.status, r.n]),
  );

  return (
    <Shell user={{ email: admin.user.email ?? '' }} activePath="/inbox">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الوارد
      </Link>

      <PageHeader
        eyebrow="AI · Suggestions"
        title="اقتراحات الـ AI"
        subtitle="مقترحات من تحليل الإيميلات (إنشاء عملاء، مشاريع، مهام، ربط threads). راجع ووافق."
        action={<RefreshButton />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="بانتظار المراجعة" value={statMap.pending ?? 0} accent />
        <Stat label="موافق عليه" value={statMap.approved ?? 0} />
        <Stat label="منفّذ" value={statMap.executed ?? 0} />
        <Stat label="مرفوض" value={statMap.rejected ?? 0} />
        <Stat label="فشل تنفيذ" value={statMap.failed ?? 0} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Brain size={20} />}
            title="لا اقتراحات معلّقة"
            description="عند وصول إيميلات business جديدة، سيقترح الـ AI إجراءات هنا تلقائياً."
          />
        </Card>
      ) : (
        <SuggestionsList
          items={rows.map((r) => ({
            id: r.id,
            type: r.suggestionType,
            typeLabel: TYPE_LABEL[r.suggestionType] ?? r.suggestionType,
            summary: r.summaryAr,
            confidence: Number(r.confidence),
            proposedData: r.proposedData as Record<string, unknown>,
            threadSubject: r.threadSubject ?? null,
            threadId: r.sourceThreadId ?? null,
            createdAt:
              r.createdAt instanceof Date
                ? r.createdAt.toISOString()
                : String(r.createdAt),
          }))}
        />
      )}
    </Shell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </p>
      <p
        className={
          'mt-1 font-mono text-[24px] ' +
          (accent ? 'text-[var(--accent)]' : 'text-[var(--text)]')
        }
      >
        {value}
      </p>
    </Card>
  );
}
