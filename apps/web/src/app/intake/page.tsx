import { redirect } from 'next/navigation';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Inbox, Sparkles } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { IntakeCard, type Candidate } from './intake-card';

export const dynamic = 'force-dynamic';

type Raw = {
  thread_id: string;
  subject: string | null;
  data: Record<string, unknown>;
  msgs: number;
};

const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const get = (o: unknown, path: string[]): unknown =>
  path.reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
const kvArr = (v: unknown): Array<{ label: string; value: string }> =>
  Array.isArray(v)
    ? v
        .map((x) => ({ label: str(get(x, ['label'])), value: str(get(x, ['value'])) }))
        .filter((k) => k.label || k.value)
    : [];
const peopleArr = (v: unknown): Array<{ name: string; role: string | null }> =>
  Array.isArray(v)
    ? v
        .map((x) => ({ name: str(get(x, ['name'])), role: str(get(x, ['role'])) || null }))
        .filter((p) => p.name)
    : [];

export default async function IntakePage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/intake');
  await requirePermission('project.create');

  // Candidate projects from email: deduped per thread, where WE replied (real
  // engagement), not yet a project, not dismissed — 10 most recent.
  const [candRaw, clientsRaw] = await Promise.all([
    db.execute(sql`
      WITH dismissed AS (
        SELECT COALESCE((SELECT value FROM system_settings WHERE key = 'intake_dismissed'), '[]'::jsonb) AS list
      ),
      cand AS (
        SELECT DISTINCT ON (et.id)
          et.id::text AS thread_id, et.subject, ex.data, ex.extracted_at,
          (SELECT count(*)::int FROM email_messages m WHERE m.thread_id = et.id) AS msgs
        FROM email_extractions ex
        JOIN email_threads et ON et.id = ex.thread_id
        WHERE et.project_id IS NULL
          AND EXISTS (SELECT 1 FROM email_messages m WHERE m.thread_id = et.id AND m.direction = 'outbound')
          AND NOT (et.id::text IN (SELECT jsonb_array_elements_text((SELECT list FROM dismissed))))
        ORDER BY et.id, ex.extracted_at DESC
      )
      SELECT thread_id, subject, data, msgs FROM cand ORDER BY extracted_at DESC LIMIT 10
    `),
    db.execute(sql`SELECT lower(name_ar) AS a, lower(name_en) AS e FROM clients WHERE archived_at IS NULL`),
  ]);

  const clientNames = new Set<string>();
  for (const r of clientsRaw as unknown as Array<{ a: string | null; e: string | null }>) {
    if (r.a) clientNames.add(r.a);
    if (r.e) clientNames.add(r.e);
  }
  const clientExists = (name: string) => {
    const n = name.toLowerCase().trim();
    if (!n) return false;
    for (const c of clientNames) if (c.includes(n) || n.includes(c)) return true;
    return false;
  };

  const candidates: Candidate[] = (candRaw as unknown as Raw[]).map((r) => {
    const d = r.data ?? {};
    const titleAr = str(get(d, ['project_signals', 'proposed_title_ar']));
    const titleEn = str(get(d, ['project_signals', 'proposed_title_en']));
    const clientName = str(get(d, ['sender', 'company']));
    const delivery = str(get(d, ['dates', 'delivery_deadline_iso']));
    return {
      threadId: r.thread_id,
      subject: r.subject ?? '(بدون عنوان)',
      msgs: r.msgs,
      title: titleEn || titleAr || (r.subject ?? ''),
      titleAr: titleAr || null,
      clientName,
      clientExists: clientExists(clientName),
      contactName: str(get(d, ['sender', 'name'])),
      contactEmail: str(get(d, ['sender', 'email'])),
      contactPhone: str(get(d, ['sender', 'phone'])) || null,
      deliveryDue: /^\d{4}-\d{2}-\d{2}/.test(delivery) ? delivery.slice(0, 10) : null,
      summary: str(get(d, ['summary_ar'])) || null,
      brief: str(get(d, ['brief_ar'])) || null,
      scopeItems: strArr(get(d, ['scope_items'])),
      keyDetails: kvArr(get(d, ['key_details'])),
      decisionMakers: peopleArr(get(d, ['decision_makers'])),
      missingInfo: strArr(get(d, ['missing_info'])),
      nextStep: str(get(d, ['next_step_ar'])) || null,
      refLinks: strArr(get(d, ['reference_links'])),
      isAbuLuka: get(d, ['is_abu_luka_content']) === true,
      businessLineReason: str(get(d, ['business_line_reason'])) || null,
    };
  });

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]">
        <ArrowLeft size={13} className="rtl:rotate-180" /> المشاريع
      </Link>

      <PageHeader
        eyebrow="Intake · مؤقت"
        title={<span className="inline-flex items-center gap-2"><Sparkles size={18} className="text-[var(--accent)]" /> مشاريع من البريد</span>}
        subtitle="آخر المشاريع اللي بدأنا فيها شغل فعلي (ردّينا عليها) — راجِع البيانات، اكمل الناقص، وأكّد لتدخل في المشاريع والعملاء وجهات الاتصال."
      />

      {candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={20} />}
            title="لا مرشّحين"
            description="مفيش محادثات بريد بدأنا فيها شغل ولسه مش متحوّلة لمشاريع. هتظهر هنا مع وصول إيميلات جديدة."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--text-dim)]">{candidates.length} مرشّح · الحقول الناقصة مظلّلة — عدّلها قبل التأكيد.</p>
          {candidates.map((c) => (
            <IntakeCard key={c.threadId} c={c} />
          ))}
        </div>
      )}
    </Shell>
  );
}
