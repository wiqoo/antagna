import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db, contacts, contactMethods, clients, projects } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  Linkedin,
  Instagram,
  Link2,
  Pencil,
  Building2,
  ExternalLink,
  Star,
  Crown,
  Briefcase,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { stageTone, stageLabelAr } from '@/lib/project-stage';

export const dynamic = 'force-dynamic';

const METHOD_META: Record<
  string,
  { icon: typeof Mail; label: string; href: (v: string) => string | undefined }
> = {
  email: { icon: Mail, label: 'بريد', href: (v) => `mailto:${v}` },
  phone: { icon: Phone, label: 'هاتف', href: (v) => `tel:${v}` },
  whatsapp: {
    icon: MessageCircle,
    label: 'واتساب',
    href: (v) => `https://wa.me/${v.replace(/[^0-9]/g, '')}`,
  },
  linkedin: { icon: Linkedin, label: 'لينكدإن', href: (v) => v },
  instagram: { icon: Instagram, label: 'إنستغرام', href: (v) => v },
  other: { icon: Link2, label: 'أخرى', href: () => undefined },
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/contacts/${id}`);

  const [contact] = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      fullNameAr: contacts.fullNameAr,
      jobTitle: contacts.jobTitle,
      jobTitleAr: contacts.jobTitleAr,
      department: contacts.department,
      isPrimary: contacts.isPrimary,
      isDecisionMaker: contacts.isDecisionMaker,
      preferredLanguage: contacts.preferredLanguage,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      clientId: contacts.clientId,
      clientNameAr: clients.nameAr,
      clientNameEn: clients.nameEn,
      clientCode: clients.code,
      clientType: clients.clientType,
      clientCity: clients.city,
      clientWebsite: clients.websiteUrl,
    })
    .from(contacts)
    .innerJoin(clients, eq(clients.id, contacts.clientId))
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) notFound();

  const [methods, clientProjects, canEdit] = await Promise.all([
    db
      .select({
        id: contactMethods.id,
        type: contactMethods.methodType,
        value: contactMethods.value,
        isPrimary: contactMethods.isPrimary,
        verifiedAt: contactMethods.verifiedAt,
      })
      .from(contactMethods)
      .where(eq(contactMethods.contactId, id))
      .orderBy(desc(contactMethods.isPrimary)),
    db
      .select({
        id: projects.id,
        code: projects.code,
        title: projects.title,
        titleAr: projects.titleAr,
        stage: projects.stage,
        contractedValueSar: projects.contractedValueSar,
      })
      .from(projects)
      .where(eq(projects.clientId, contact.clientId))
      .orderBy(desc(projects.createdAt))
      .limit(20),
    can('contact.update'),
  ]);

  const clientLabel =
    contact.clientNameAr ?? contact.clientNameEn ?? contact.clientCode ?? '—';

  const hints: AIHint[] = [];
  if (methods.length === 0) {
    hints.push({
      index: '01',
      text: 'لا توجد وسيلة اتصال مسجّلة',
      insight: 'أضف بريداً أو رقم هاتف لتفعيل المتابعة والتنبيهات.',
      actions: canEdit ? [{ label: 'أضف وسيلة', href: `/contacts/${id}/edit`, primary: true }] : undefined,
    });
  }
  if (contact.isDecisionMaker && !methods.some((m) => m.type === 'email')) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: 'صاحب قرار بدون بريد مسجّل',
      insight: 'بريد صاحب القرار ضروري لإرسال العروض واعتمادها.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        كل جهات الاتصال
      </Link>

      {hints.length > 0 && (
        <AIHints
          context={`Antagna AI · ${contact.fullName}`}
          headline={`${methods.length} وسيلة اتصال · ${clientLabel}`}
          hints={hints}
          compact
        />
      )}

      {/* Header */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-72 w-72 rounded-full bg-blue-500 opacity-[0.05] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={contact.fullName} size="lg" />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {contact.isPrimary && (
                  <StatusPill tone="accent" withDot={false}>
                    <Star size={10} className="me-1 inline" />
                    أساسي
                  </StatusPill>
                )}
                {contact.isDecisionMaker && (
                  <StatusPill tone="warning" withDot={false}>
                    <Crown size={10} className="me-1 inline" />
                    صاحب قرار
                  </StatusPill>
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
                {contact.fullName}
              </h1>
              {contact.fullNameAr && contact.fullNameAr !== contact.fullName && (
                <p className="text-sm text-[var(--text-muted)]">{contact.fullNameAr}</p>
              )}
              <p className="text-sm text-[var(--text-muted)]">
                {[contact.jobTitle, contact.department].filter(Boolean).join(' · ') || '—'}
              </p>
              <p className="flex items-center gap-1.5 text-sm">
                <Building2 size={13} className="text-[var(--text-dim)]" />
                <Link
                  href={`/clients/${contact.clientId}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  {clientLabel}
                </Link>
                <StatusPill tone="neutral">{contact.clientType}</StatusPill>
              </p>
            </div>
          </div>
          {canEdit && (
            <Link
              href={`/contacts/${id}/edit`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm hover:border-[var(--accent)]"
            >
              <Pencil size={14} />
              تعديل
            </Link>
          )}
        </div>
      </Card>

      {/* Contact methods */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader title="وسائل التواصل" subtitle={`${methods.length} وسيلة`} />
        </div>
        {methods.length === 0 ? (
          <EmptyState
            icon={<Mail size={20} />}
            title="لا توجد وسائل تواصل"
            description={canEdit ? 'أضف بريداً أو هاتفاً من زر التعديل.' : 'لم تُسجَّل بعد.'}
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {methods.map((m) => {
              const meta = METHOD_META[m.type] ?? METHOD_META.other!;
              const Icon = meta.icon;
              const href = meta.href(m.value);
              return (
                <li key={m.id} className="flex items-center gap-3 px-6 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)]">
                      {meta.label}
                    </p>
                    {href ? (
                      <a
                        href={href}
                        dir="ltr"
                        className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)]"
                      >
                        {m.value}
                      </a>
                    ) : (
                      <span dir="ltr" className="font-mono text-sm text-[var(--text)]">
                        {m.value}
                      </span>
                    )}
                  </div>
                  {m.isPrimary && (
                    <StatusPill tone="accent" withDot={false}>
                      أساسي
                    </StatusPill>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Linked client's projects */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title={`مشاريع ${clientLabel}`}
            subtitle={`${clientProjects.length} مشروع`}
            action={
              <Link
                href={`/clients/${contact.clientId}`}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--accent)]"
              >
                <ExternalLink size={12} />
                ملف العميل
              </Link>
            }
          />
        </div>
        {clientProjects.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={20} />}
            title="لا مشاريع لهذا العميل"
            description="ابدأ مشروعاً من صفحة العميل."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {clientProjects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]"
                >
                  <span className="font-mono text-xs text-[var(--text-dim)]">{p.code}</span>
                  <span className="flex-1 truncate text-sm text-[var(--text)]">
                    {p.titleAr ?? p.title}
                  </span>
                  {p.contractedValueSar && (
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      {Number(p.contractedValueSar).toLocaleString('en-US')} ر.س
                    </span>
                  )}
                  <StatusPill tone={stageTone(p.stage)}>{stageLabelAr(p.stage)}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {contact.notes && (
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
            ملاحظات
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
            {contact.notes}
          </p>
        </Card>
      )}
    </Shell>
  );
}
