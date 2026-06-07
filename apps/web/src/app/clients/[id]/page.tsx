import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  contactMethods,
  projects,
  vClientsSafe,
  vContactsSafe,
  withProfileScope,
} from '@antagna/db';
import { getEffectiveProfileId, requirePermission } from '@/lib/authz';
import { financialsHidden } from '@/lib/financials';
import {

  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
  Button,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  Pencil,
  Plus,
  ExternalLink,
  Sparkles,
  Globe,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { SubmitButton } from '@antagna/ui';
import { addContact, enrichClientAction } from '../actions';

type ClientEnrichment = {
  summary_ar?: string | null;
  summary_en?: string | null;
  industry?: string | null;
  website_url?: string | null;
  hq_location?: string | null;
  company_size?: string | null;
  key_facts?: string[];
  sources?: string[];
  enriched_at?: string | null;
};

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    contactError?: string;
    fullName?: string;
    jobTitle?: string;
    email?: string;
    enrichError?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  // Surfaced from the add-contact action below: when addContact returns
  // { ok:false, error }, the wrapper redirects back here with the error +
  // the values the user typed so we can render the message and repopulate.
  const contactError =
    typeof sp.contactError === 'string' ? sp.contactError : null;
  const contactFullName =
    typeof sp.fullName === 'string' ? sp.fullName : '';
  const contactJobTitle =
    typeof sp.jobTitle === 'string' ? sp.jobTitle : '';
  const contactEmail = typeof sp.email === 'string' ? sp.email : '';
  const enrichError = typeof sp.enrichError === 'string' ? sp.enrichError : null;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/clients/${id}`);

  // Page guard: must hold client.read (redirects to /dashboard if denied).
  await requirePermission('client.read');

  // Field-level masking (D-037/D-039): client + contacts (+ the contact-methods
  // join, which is keyed on the masked contacts entity) read the v_*_safe views.
  // All masked reads run inside ONE withProfileScope transaction so the
  // app.current_profile_id GUC reaches each view's CASE WHEN masks on the same
  // pinned 6543-pooler backend. Projects are NOT a masked-here entity; they read
  // the base table. Do NOT nest withProfileScope.
  const effectivePid = await getEffectiveProfileId();
  const { client, contactList, projectList, methodRows } = await withProfileScope(
    effectivePid,
    async (tx) => {
      const [client] = await tx
        .select()
        .from(vClientsSafe)
        .where(eq(vClientsSafe.id, id))
        .limit(1);

      const [contactList, projectList, methodRows] = await Promise.all([
        tx
          .select()
          .from(vContactsSafe)
          .where(eq(vContactsSafe.clientId, id))
          .orderBy(desc(vContactsSafe.isPrimary), vContactsSafe.fullName),
        tx
          .select({
            id: projects.id,
            code: projects.code,
            title: projects.title,
            titleAr: projects.titleAr,
            stage: projects.stage,
            contractedValueSar: projects.contractedValueSar,
            deliveryDueAt: projects.deliveryDueAt,
          })
          .from(projects)
          .where(eq(projects.clientId, id))
          .orderBy(desc(projects.createdAt))
          .limit(30),
        tx
          .select({
            contactId: contactMethods.contactId,
            type: contactMethods.methodType,
            value: contactMethods.value,
          })
          .from(contactMethods)
          .innerJoin(vContactsSafe, eq(vContactsSafe.id, contactMethods.contactId))
          .where(eq(vContactsSafe.clientId, id)),
      ]);

      return { client, contactList, projectList, methodRows };
    },
  );

  if (!client) notFound();

  // v_clients_safe can return a NON-NULL row whose masked columns are NULL
  // (field-level masking). Guard every field the JSX renders so we never paint
  // a literal "null". Robust whether the page reads the safe view or the base
  // table.
  const nameAr = client.nameAr ?? 'العميل';
  const nameEn = client.nameEn ?? null;
  const code = client.code ?? '—';
  const clientType = client.clientType ?? '—';
  const industry = client.industry ?? null;
  const city = client.city ?? null;
  const country = client.country ?? null;
  const websiteUrl = client.websiteUrl ?? null;
  const legalName = client.legalName ?? null;
  const vatNumber = client.vatNumber ?? null;
  const crNumber = client.crNumber ?? null;
  const notes = client.notes ?? null;

  // Void-returning wrapper: addContact returns a structured { ok, error }
  // result, but a <form action> must resolve to void. Instead of discarding
  // it, on failure we redirect back to this page with the error + the values
  // the user typed (as query params) so the form can render an inline message
  // and repopulate — no more silent no-op. On success addContact's own
  // revalidatePath refreshes the list; we redirect to the clean URL so a
  // refresh can't resubmit / keep a stale error.
  async function addContactAction(formData: FormData): Promise<void> {
    'use server';
    const result = await addContact(id, formData);
    if (result && !result.ok) {
      const qs = new URLSearchParams({
        contactError: result.error ?? 'تعذّر إضافة جهة الاتصال',
        fullName: formData.get('fullName')?.toString() ?? '',
        jobTitle: formData.get('jobTitle')?.toString() ?? '',
        email: formData.get('email')?.toString() ?? '',
      });
      redirect(`/clients/${id}?${qs.toString()}`);
    }
    redirect(`/clients/${id}`);
  }

  // AI web-research enrichment (stored in custom_fields by enrichClientAction).
  // Read from the base table — non-masked metadata, same id already confirmed
  // visible via the safe view above.
  const enrR = (await db.execute(sql`
    SELECT custom_fields->'enrichment' AS enrichment
    FROM clients WHERE id = ${id}::uuid LIMIT 1`)) as unknown as Array<{
    enrichment: ClientEnrichment | null;
  }>;
  const enrichment = enrR[0]?.enrichment ?? null;

  // Void-returning wrapper for the enrich button → runs the web research, then
  // redirects back (with an error param on failure, mirroring addContactAction).
  async function enrichAction(): Promise<void> {
    'use server';
    const res = await enrichClientAction(id);
    redirect(
      res.ok
        ? `/clients/${id}`
        : `/clients/${id}?enrichError=${encodeURIComponent(res.error ?? 'تعذّر الإثراء')}`,
    );
  }

  const methodsByContact = methodRows.reduce<
    Record<string, Array<{ type: string; value: string }>>
  >((acc, m) => {
    (acc[m.contactId] ??= []).push({ type: m.type, value: m.value });
    return acc;
  }, {});

  // AI hints based on client + projects
  const now = new Date();
  const activeProjects = projectList.filter(
    (p) => !['delivered', 'archived', 'lost', 'cancelled'].includes(p.stage),
  );
  const daysSinceLastProject = null as number | null;
  const noContacts = contactList.length === 0;
  const overdueProjects = activeProjects.filter(
    (p) => p.deliveryDueAt && new Date(p.deliveryDueAt) < now,
  );

  const hints: AIHint[] = [];
  if (overdueProjects.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${overdueProjects.length} مشروع متأخر مع هذا العميل`,
      insight: 'تواصل مع العميل بشأن مواعيد التسليم الجديدة.',
      urgent: true,
    });
  }
  if (noContacts) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `لا توجد جهة اتصال مسجّلة`,
      insight: 'أضف جهة اتصال واحدة على الأقل لتسهيل التواصل والتنبيهات.',
    });
  } else if (daysSinceLastProject != null && daysSinceLastProject >= 90 && activeProjects.length === 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `لا مشاريع نشطة منذ ${daysSinceLastProject} يوم`,
      insight: 'فرصة لتجديد العلاقة برسالة متابعة أو استطلاع.',
    });
  }
  if (client.averagePaymentDays && Number(client.averagePaymentDays) > 60) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `متوسط السداد ${client.averagePaymentDays} يوم`,
      insight: 'فترة سداد طويلة — راجع شروط الدفع للمشاريع القادمة.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <Link
        href="/crm"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        كل العملاء
      </Link>

      {hints.length > 0 && (
        <AIHints
          context={`Antagna AI · ${nameAr}`}
          headline={`${projectList.length} مشروع · ${activeProjects.length} نشط`}
          hints={hints}
          compact
        />
      )}

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-72 w-72 rounded-full bg-blue-500 opacity-[0.05] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={nameAr} size="lg" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                  {code}
                </span>
                <StatusPill tone="neutral">{clientType}</StatusPill>
                {industry && (
                  <StatusPill tone="info" withDot={false}>
                    {industry}
                  </StatusPill>
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
                {nameAr}
              </h1>
              {nameEn && (
                <p className="text-sm text-[var(--text-muted)]">{nameEn}</p>
              )}
              <p className="text-sm text-[var(--text-muted)]">
                {[city, country].filter(Boolean).join(' · ') || '—'}
                {websiteUrl && (
                  <>
                    {' '}·{' '}
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
                    >
                      <ExternalLink size={11} />
                      الموقع
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
          <Link
            href={`/clients/${id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm hover:border-[var(--accent)]"
          >
            <Pencil size={14} />
            تعديل
          </Link>
        </div>
        {(vatNumber || crNumber || legalName) && (
          <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-4 text-xs md:grid-cols-3">
            {legalName && (
              <div>
                <p className="text-[var(--text-dim)]">الاسم القانوني</p>
                <p className="mt-0.5 text-[var(--text)]">{legalName}</p>
              </div>
            )}
            {vatNumber && (
              <div>
                <p className="text-[var(--text-dim)]">VAT</p>
                <p className="mt-0.5 font-mono text-[var(--text)]">{vatNumber}</p>
              </div>
            )}
            {crNumber && (
              <div>
                <p className="text-[var(--text-dim)]">CR</p>
                <p className="mt-0.5 font-mono text-[var(--text)]">{crNumber}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* AI web research / enrichment */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Globe size={14} className="text-[var(--accent)]" /> بحث الـ AI عن العميل
              </span>
            }
            subtitle={
              enrichment?.enriched_at
                ? `محدَّث ${new Date(enrichment.enriched_at).toISOString().slice(0, 10)} · يغذّي ذاكرة النظام`
                : 'يبحث على الويب: مَن هم، قطاعهم، معلومات تفيد البريف — ويضيفها لذاكرة النظام'
            }
          />
          <form action={enrichAction}>
            <SubmitButton
              pendingText="يبحث على الويب…"
              className="h-9 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
            >
              <Sparkles size={13} /> {enrichment ? 'حدِّث البحث' : 'ابحث وأثرِ'}
            </SubmitButton>
          </form>
        </div>

        {enrichError && (
          <p role="alert" className="mt-3 text-[12px] text-[var(--danger,#ef4444)]">
            ⚠ {enrichError}
          </p>
        )}

        {enrichment ? (
          <div className="mt-4 space-y-3">
            {enrichment.summary_ar && (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text)]">
                {enrichment.summary_ar}
              </p>
            )}
            {(enrichment.industry || enrichment.company_size || enrichment.hq_location) && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                {enrichment.industry && (
                  <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[var(--text-muted)]">
                    {enrichment.industry}
                  </span>
                )}
                {enrichment.company_size && (
                  <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[var(--text-muted)]">
                    الحجم: {enrichment.company_size}
                  </span>
                )}
                {enrichment.hq_location && (
                  <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[var(--text-muted)]">
                    {enrichment.hq_location}
                  </span>
                )}
              </div>
            )}
            {enrichment.key_facts && enrichment.key_facts.length > 0 && (
              <ul className="space-y-1.5">
                {enrichment.key_facts.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-muted)]">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {enrichment.sources && enrichment.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2.5 text-[10px]">
                <span className="text-[var(--text-dim)]">المصادر:</span>
                {enrichment.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="inline-flex items-center gap-1 font-mono text-[var(--accent)] hover:underline"
                  >
                    <ExternalLink size={9} /> {sourceHost(s)}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          !enrichError && (
            <p className="mt-3 text-[12px] text-[var(--text-dim)]">
              اضغط "ابحث وأثرِ" ليبحث الـ AI عن الشركة على الويب ويلخّص مَن هم — ويضيف ما يتعلّمه لذاكرة النظام لاقتراحات أذكى لاحقاً.
            </p>
          )
        )}
      </Card>

      {/* Contacts */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="جهات الاتصال"
            subtitle={`${contactList.length} جهة`}
          />
          <form
            action={addContactAction}
            className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1.5fr_1fr_1fr_auto]"
          >
            <input
              type="text"
              name="fullName"
              required
              defaultValue={contactFullName}
              aria-invalid={contactError ? true : undefined}
              placeholder="الاسم الكامل *"
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
            <input
              type="text"
              name="jobTitle"
              defaultValue={contactJobTitle}
              placeholder="المنصب"
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
            <input
              type="email"
              name="email"
              defaultValue={contactEmail}
              placeholder="email"
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm font-mono"
            />
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>
              إضافة
            </Button>
          </form>
          {contactError && (
            <p
              role="alert"
              className="mt-2 text-xs text-[var(--danger,#ef4444)]"
            >
              {contactError}
            </p>
          )}
        </div>

        {contactList.length === 0 ? (
          <EmptyState
            icon={<Mail size={20} />}
            title="لا توجد جهات اتصال"
            description="استخدم الفورم لإضافة أول جهة."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {contactList.map((c) => {
              const methods = (c.id ? methodsByContact[c.id] : undefined) ?? [];
              return (
                <li key={c.id} className="flex items-start gap-3 px-6 py-3">
                  <Avatar name={c.fullName ?? '—'} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {c.fullName ?? '—'}
                      </p>
                      {c.isPrimary && (
                        <StatusPill tone="accent" withDot={false}>
                          أساسي
                        </StatusPill>
                      )}
                      {c.isDecisionMaker && (
                        <StatusPill tone="warning" withDot={false}>
                          صاحب قرار
                        </StatusPill>
                      )}
                    </div>
                    {c.jobTitle && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {c.jobTitle}
                      </p>
                    )}
                    {methods.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                        {methods.map((m, i) => {
                          const Icon =
                            m.type === 'email'
                              ? Mail
                              : m.type === 'phone'
                                ? Phone
                                : MessageCircle;
                          return (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 text-[var(--text-muted)]"
                            >
                              <Icon size={11} className="text-[var(--text-dim)]" />
                              <span className="font-mono text-[var(--text)]">
                                {m.value}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Projects with this client */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="المشاريع"
            subtitle={`${projectList.length} مشروع`}
          />
        </div>
        {projectList.length === 0 ? (
          <EmptyState
            icon={<Plus size={20} />}
            title="لا مشاريع بعد"
            description="ابدأ مشروع لهذا العميل من صفحة المشاريع."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {projectList.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]"
                >
                  <span className="font-mono text-xs text-[var(--text-dim)]">
                    {p.code}
                  </span>
                  <span className="flex-1 truncate text-sm text-[var(--text)]">
                    {p.titleAr ?? p.title}
                  </span>
                  {!financialsHidden() && p.contractedValueSar && (
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      {Number(p.contractedValueSar).toLocaleString('en-US')} ر.س
                    </span>
                  )}
                  <StatusPill tone={stageTone(p.stage)}>
                    {stageLabelAr(p.stage)}
                  </StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {notes && (
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
            ملاحظات
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
            {notes}
          </p>
        </Card>
      )}
    </Shell>
  );
}

/** Short, readable host for an enrichment source link. */
function sourceHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u.slice(0, 28);
  }
}
