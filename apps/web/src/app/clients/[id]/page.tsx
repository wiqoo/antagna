import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  clients,
  contacts,
  contactMethods,
  projects,
} from '@antagna/db';
import {
  
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
  Button,
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
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { addContact } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/clients/${id}`);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) notFound();

  const [contactList, projectList, methodRows] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(eq(contacts.clientId, id))
      .orderBy(desc(contacts.isPrimary), contacts.fullName),
    db
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
    db
      .select({
        contactId: contactMethods.contactId,
        type: contactMethods.methodType,
        value: contactMethods.value,
      })
      .from(contactMethods)
      .innerJoin(contacts, eq(contacts.id, contactMethods.contactId))
      .where(eq(contacts.clientId, id)),
  ]);

  const methodsByContact = methodRows.reduce<
    Record<string, Array<{ type: string; value: string }>>
  >((acc, m) => {
    (acc[m.contactId] ??= []).push({ type: m.type, value: m.value });
    return acc;
  }, {});

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <Link
        href="/crm"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        كل العملاء
      </Link>

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-72 w-72 rounded-full bg-blue-500 opacity-[0.05] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={client.nameAr} size="lg" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                  {client.code}
                </span>
                <StatusPill tone="neutral">{client.clientType}</StatusPill>
                {client.industry && (
                  <StatusPill tone="info" withDot={false}>
                    {client.industry}
                  </StatusPill>
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
                {client.nameAr}
              </h1>
              {client.nameEn && (
                <p className="text-sm text-[var(--text-muted)]">{client.nameEn}</p>
              )}
              <p className="text-sm text-[var(--text-muted)]">
                {[client.city, client.country].filter(Boolean).join(' · ')}
                {client.websiteUrl && (
                  <>
                    {' '}·{' '}
                    <a
                      href={client.websiteUrl}
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
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm hover:border-[var(--accent)]"
          >
            <Pencil size={14} />
            تعديل
          </Link>
        </div>
        {(client.vatNumber || client.crNumber || client.legalName) && (
          <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-4 text-xs md:grid-cols-3">
            {client.legalName && (
              <div>
                <p className="text-[var(--text-dim)]">الاسم القانوني</p>
                <p className="mt-0.5 text-[var(--text)]">{client.legalName}</p>
              </div>
            )}
            {client.vatNumber && (
              <div>
                <p className="text-[var(--text-dim)]">VAT</p>
                <p className="mt-0.5 font-mono text-[var(--text)]">{client.vatNumber}</p>
              </div>
            )}
            {client.crNumber && (
              <div>
                <p className="text-[var(--text-dim)]">CR</p>
                <p className="mt-0.5 font-mono text-[var(--text)]">{client.crNumber}</p>
              </div>
            )}
          </div>
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
            action={addContact.bind(null, id)}
            className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1.5fr,1fr,1fr,auto]"
          >
            <input
              type="text"
              name="fullName"
              required
              placeholder="الاسم الكامل *"
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
            <input
              type="text"
              name="jobTitle"
              placeholder="المنصب"
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
            <input
              type="email"
              name="email"
              placeholder="email"
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm font-mono"
            />
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>
              إضافة
            </Button>
          </form>
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
              const methods = methodsByContact[c.id] ?? [];
              return (
                <li key={c.id} className="flex items-start gap-3 px-6 py-3">
                  <Avatar name={c.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {c.fullName}
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
                  {p.contractedValueSar && (
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

      {client.notes && (
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
            ملاحظات
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
            {client.notes}
          </p>
        </Card>
      )}
    </Shell>
  );
}
