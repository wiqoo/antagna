import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { StatusPill, MoneyDisplay } from '@antagna/ui';
import { stageTone, stageLabelAr } from '@/lib/project-stage';

export const dynamic = 'force-dynamic';

type ShareRow = {
  share_id: string;
  audience_label: string | null;
  show_sections: string[];
  revoked_at: Date | null;
  expires_at: Date | null;
  project_id: string;
  project_code: string;
  project_title: string;
  project_title_ar: string | null;
  project_stage: string;
  project_value: string | null;
  delivery_due_at: Date | null;
  ai_status: string | null;
  client_name_ar: string;
  client_code: string;
};

type DeliverableRow = {
  d_id: string;
  d_title: string | null;
  d_item_number: string | null;
  d_status: string;
  group_name_ar: string;
  group_kind: string | null;
};

const STATUS_LABEL_AR: Record<string, string> = {
  draft: 'قيد التحضير',
  submitted: 'في الانتظار',
  pending_director: 'مراجعة داخلية',
  pending_am: 'مراجعة داخلية',
  revisions_director: 'قيد التعديل',
  revisions_am: 'قيد التعديل',
  client_ready: 'جاهز للمراجعة',
  in_client_review: 'قيد المراجعة',
  revisions_client: 'قيد التعديل',
  delivered: 'مُسلَّم ✓',
  cancelled: 'مُلغى',
};

const STATUS_TONE: Record<
  string,
  'neutral' | 'info' | 'warning' | 'danger' | 'success' | 'accent'
> = {
  draft: 'neutral',
  submitted: 'info',
  pending_director: 'neutral',
  pending_am: 'neutral',
  revisions_director: 'warning',
  revisions_am: 'warning',
  client_ready: 'accent',
  in_client_review: 'info',
  revisions_client: 'warning',
  delivered: 'success',
  cancelled: 'neutral',
};

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const shareRes = (await db.execute<ShareRow>(sql`
    SELECT
      psv.id::text AS share_id,
      psv.audience_label,
      psv.show_sections,
      psv.revoked_at,
      psv.expires_at,
      p.id::text AS project_id,
      p.code AS project_code,
      p.title AS project_title,
      p.title_ar AS project_title_ar,
      p.stage::text AS project_stage,
      p.contracted_value_sar::text AS project_value,
      p.delivery_due_at,
      p.ai_status_paragraph AS ai_status,
      c.name_ar AS client_name_ar,
      c.code AS client_code
    FROM project_share_views psv
    INNER JOIN projects p ON p.id = psv.project_id
    INNER JOIN clients c ON c.id = p.client_id
    WHERE psv.share_token = ${token}::uuid
    LIMIT 1
  `)) as unknown as ShareRow[];

  const share = shareRes[0];
  if (!share) notFound();

  if (share.revoked_at) return <RevokedView />;
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return <ExpiredView expiresAt={share.expires_at} />;
  }

  const showDeliverables = share.show_sections.includes('deliverables');
  const showOverview = share.show_sections.includes('overview');

  const deliverables = showDeliverables
    ? ((await db.execute<DeliverableRow>(sql`
        SELECT
          d.id::text AS d_id,
          d.title AS d_title,
          d.item_number AS d_item_number,
          d.status::text AS d_status,
          dg.name_ar AS group_name_ar,
          dg.kind AS group_kind
        FROM deliverables d
        INNER JOIN deliverable_groups dg ON dg.id = d.group_id
        WHERE d.project_id = ${share.project_id}::uuid
          AND d.status NOT IN ('draft','submitted','pending_director','pending_am','revisions_director','revisions_am','cancelled')
        ORDER BY dg.position, dg.created_at, d.position, d.created_at
      `)) as unknown as DeliverableRow[])
    : [];

  const byGroup: Record<
    string,
    { nameAr: string; kind: string | null; items: DeliverableRow[] }
  > = {};
  for (const d of deliverables) {
    const key = d.group_name_ar;
    if (!byGroup[key])
      byGroup[key] = { nameAr: key, kind: d.group_kind, items: [] };
    byGroup[key].items.push(d);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir="rtl">
      <header className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/60 backdrop-blur-2xl">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight">Antagna</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                portal
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              Volt Production · Jeddah
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        {showOverview && (
          <section className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              — مشاركة {share.audience_label ?? 'مع العميل'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                {share.project_code}
              </span>
              <StatusPill tone={stageTone(share.project_stage)}>
                {stageLabelAr(share.project_stage)}
              </StatusPill>
            </div>
            <h1 className="text-[40px] font-bold leading-[1.1] tracking-tight md:text-[48px]">
              {share.project_title_ar ?? share.project_title}
            </h1>
            <p className="text-[14px] text-[var(--text-muted)]">
              {share.client_name_ar}
              {share.delivery_due_at && (
                <>
                  {' '}· التسليم{' '}
                  <span className="font-mono text-[var(--text)]">
                    {new Date(share.delivery_due_at).toISOString().slice(0, 10)}
                  </span>
                </>
              )}
            </p>

            {share.ai_status && (
              <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] p-4 text-[13px] leading-relaxed">
                {share.ai_status}
              </div>
            )}

            {share.project_value && (
              <div className="border-y border-[var(--line)] py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                  قيمة المشروع
                </p>
                <p className="mt-2 text-2xl font-bold tabular">
                  <MoneyDisplay
                    amount={Number(share.project_value)}
                    currency="SAR"
                  />
                </p>
              </div>
            )}
          </section>
        )}

        {showDeliverables && (
          <section className="space-y-6">
            <header>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                — المخرجات
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
                {deliverables.length === 0
                  ? 'لا توجد مخرجات جاهزة بعد'
                  : 'المحتوى المُسلَّم'}
              </h2>
            </header>

            {Object.entries(byGroup).map(([groupName, g]) => (
              <div key={groupName} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">
                    {g.nameAr}
                  </h3>
                  {g.kind && (
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                      {g.kind}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {g.items.map((it) => (
                    <li
                      key={it.d_id}
                      className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-4 py-3"
                    >
                      <span className="font-mono text-[11px] text-[var(--text-dim)]">
                        {it.d_item_number ?? '#'}
                      </span>
                      <span className="flex-1 text-[13px] text-[var(--text)]">
                        {it.d_title ?? '(بدون عنوان)'}
                      </span>
                      <StatusPill tone={STATUS_TONE[it.d_status] ?? 'neutral'}>
                        {STATUS_LABEL_AR[it.d_status] ?? it.d_status}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <footer className="border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
          <p>— صفحة مشاركة آمنة · Antagna · Volt Production</p>
          <p className="mt-1 text-[var(--text-muted)]">
            هذه الصفحة محمية برابط فريد. الرجاء عدم مشاركتها مع أطراف ثالثة.
          </p>
        </footer>
      </main>
    </div>
  );
}

function RevokedView() {
  return (
    <PortalNotice
      title="الرابط ملغى"
      description="هذا الرابط أُلغي من قِبَل فريق Volt Production. يرجى التواصل معهم للحصول على رابط جديد."
    />
  );
}

function ExpiredView({ expiresAt }: { expiresAt: Date }) {
  return (
    <PortalNotice
      title="انتهت صلاحية الرابط"
      description={`الرابط انتهت صلاحيته في ${new Date(expiresAt).toISOString().slice(0, 10)}. تواصل مع فريق Volt للحصول على رابط جديد.`}
    />
  );
}

function PortalNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      dir="rtl"
      className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-center text-[var(--text)]"
    >
      <div className="max-w-md space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
          — Antagna Portal
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-[13px] text-[var(--text-muted)]">{description}</p>
      </div>
    </div>
  );
}
