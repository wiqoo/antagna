import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import {
  withProfileScope,
  vContactsSafe,
  vClientsSafe,
  vProjectsSafe,
  contactMethods,
} from '@antagna/db';
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
import { can, requirePermission } from '@/lib/authz';
import { getFormat } from '@/lib/format';
import { getLocale } from 'next-intl/server';
import { stageTone, stageLabel } from '@/lib/project-stage';

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

  // Page guard + masked-scope id. requirePermission redirects signed-out →
  // /login and lacking-permission → /dashboard, and returns the effective
  // profile id we hand to the masking transaction (resolved once).
  const { profileId } = await requirePermission('client.read');
  const f = await getFormat();
  const locale = await getLocale();

  // ONE transaction wraps EVERY masked read for this page: the contact + its
  // client (v_contacts_safe ⨝ v_clients_safe) and the client's projects
  // (v_projects_safe). These views read app.current_profile_id, set by
  // withProfileScope on the pinned txn connection. contact_methods is unmasked
  // and read on the SAME tx so the page stays one transaction — do NOT nest.
  // The reads are sequential inside the tx because methods/projects key off the
  // contact's (possibly masked) clientId resolved by the first read.
  const scoped = await withProfileScope(profileId, async (tx) => {
    const [contact] = await tx
      .select({
        id: vContactsSafe.id,
        fullName: vContactsSafe.fullName,
        fullNameAr: vContactsSafe.fullNameAr,
        jobTitle: vContactsSafe.jobTitle,
        jobTitleAr: vContactsSafe.jobTitleAr,
        department: vContactsSafe.department,
        isPrimary: vContactsSafe.isPrimary,
        isDecisionMaker: vContactsSafe.isDecisionMaker,
        preferredLanguage: vContactsSafe.preferredLanguage,
        notes: vContactsSafe.notes,
        createdAt: vContactsSafe.createdAt,
        clientId: vContactsSafe.clientId,
        clientNameAr: vClientsSafe.nameAr,
        clientNameEn: vClientsSafe.nameEn,
        clientCode: vClientsSafe.code,
        clientType: vClientsSafe.clientType,
        clientCity: vClientsSafe.city,
        clientWebsite: vClientsSafe.websiteUrl,
      })
      .from(vContactsSafe)
      // clientId may be masked → leftJoin so the contact still renders; the
      // client fields null-guard to "—" downstream.
      .leftJoin(vClientsSafe, eq(vClientsSafe.id, vContactsSafe.clientId))
      .where(eq(vContactsSafe.id, id))
      .limit(1);

    if (!contact) return null;

    const methods = await tx
      .select({
        id: contactMethods.id,
        type: contactMethods.methodType,
        value: contactMethods.value,
        isPrimary: contactMethods.isPrimary,
        verifiedAt: contactMethods.verifiedAt,
      })
      .from(contactMethods)
      .where(eq(contactMethods.contactId, id))
      .orderBy(desc(contactMethods.isPrimary));

    // Only join projects when the client survived masking; a masked clientId
    // means we have no client context to scope projects to.
    const clientProjects = contact.clientId
      ? await tx
          .select({
            id: vProjectsSafe.id,
            code: vProjectsSafe.code,
            title: vProjectsSafe.title,
            titleAr: vProjectsSafe.titleAr,
            stage: vProjectsSafe.stage,
            contractedValueSar: vProjectsSafe.contractedValueSar,
          })
          .from(vProjectsSafe)
          .where(eq(vProjectsSafe.clientId, contact.clientId))
          .orderBy(desc(vProjectsSafe.createdAt))
          .limit(20)
      : [];

    return { contact, methods, clientProjects };
  });

  if (!scoped) notFound();
  const { contact, methods, clientProjects } = scoped;

  // can() runs its own (non-masked) has_permission query OUTSIDE the masking
  // transaction — never nest it inside withProfileScope.
  const canEdit = await can('contact.update');

  const clientLabel =
    contact.clientNameAr ?? contact.clientNameEn ?? contact.clientCode ?? '—';
  // fullName is NOT NULL in the base table but the safe view masks it to NULL.
  const displayName = contact.fullName ?? '—';

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
          context={`Antagna AI · ${displayName}`}
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
            <Avatar name={displayName} size="lg" />
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
                {displayName}
              </h1>
              {contact.fullNameAr && contact.fullNameAr !== contact.fullName && (
                <p className="text-sm text-[var(--text-muted)]">{contact.fullNameAr}</p>
              )}
              <p className="text-sm text-[var(--text-muted)]">
                {[contact.jobTitle, contact.department].filter(Boolean).join(' · ') || '—'}
              </p>
              <p className="flex items-center gap-1.5 text-sm">
                <Building2 size={13} className="text-[var(--text-dim)]" />
                {contact.clientId ? (
                  <Link
                    href={`/clients/${contact.clientId}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {clientLabel}
                  </Link>
                ) : (
                  <span className="text-[var(--text-muted)]">{clientLabel}</span>
                )}
                {contact.clientType && (
                  <StatusPill tone="neutral">{contact.clientType}</StatusPill>
                )}
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
              contact.clientId ? (
                <Link
                  href={`/clients/${contact.clientId}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--accent)]"
                >
                  <ExternalLink size={12} />
                  ملف العميل
                </Link>
              ) : undefined
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
            {clientProjects
              .filter((p): p is typeof p & { id: string } => p.id != null)
              .map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]"
                >
                  <span className="font-mono text-xs text-[var(--text-dim)]">{p.code}</span>
                  <span className="flex-1 truncate text-sm text-[var(--text)]">
                    {p.titleAr ?? p.title ?? '—'}
                  </span>
                  {p.contractedValueSar && (
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      {f.currency(Number(p.contractedValueSar))}
                    </span>
                  )}
                  <StatusPill tone={stageTone(p.stage)}>{stageLabel(p.stage, locale)}</StatusPill>
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
