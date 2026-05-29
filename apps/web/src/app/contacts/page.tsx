import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, isNull, sql } from 'drizzle-orm';
import { db, contacts, contactMethods, clients } from '@antagna/db';
import {
  PageHeader,
  Card,
  StatBox,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { UserPlus, Users, Star, Crown, Mail } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ContactsDirectory, type ContactRow } from './ContactsDirectory';

export const dynamic = 'force-dynamic';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; flag?: string }>;
}) {
  const sp = await searchParams;
  const clientFilter = sp.client?.trim() || null;
  const flagFilter = sp.flag?.trim() || null;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/contacts');

  // One query: contacts + their client + their methods pivoted to columns.
  // contact_methods is 1:N; we pick the first value of each type via a grouped
  // subquery so the page renders a single row per contact.
  const [contactRows, methodRows] = await Promise.all([
    db
      .select({
        id: contacts.id,
        fullName: contacts.fullName,
        fullNameAr: contacts.fullNameAr,
        jobTitle: contacts.jobTitle,
        department: contacts.department,
        isPrimary: contacts.isPrimary,
        isDecisionMaker: contacts.isDecisionMaker,
        clientId: contacts.clientId,
        clientNameAr: clients.nameAr,
        clientNameEn: clients.nameEn,
        clientCode: clients.code,
      })
      .from(contacts)
      .innerJoin(clients, eq(clients.id, contacts.clientId))
      .where(isNull(contacts.archivedAt))
      .orderBy(sql`${contacts.isPrimary} DESC`, contacts.fullName),
    db
      .select({
        contactId: contactMethods.contactId,
        type: contactMethods.methodType,
        value: contactMethods.value,
      })
      .from(contactMethods)
      .innerJoin(contacts, eq(contacts.id, contactMethods.contactId))
      .where(isNull(contacts.archivedAt)),
  ]);

  // Pivot methods → first email / phone / whatsapp per contact.
  const methodsByContact = methodRows.reduce<
    Record<string, { email?: string; phone?: string; whatsapp?: string }>
  >((acc, m) => {
    const bucket = (acc[m.contactId] ??= {});
    if (m.type === 'email' && !bucket.email) bucket.email = m.value;
    else if (m.type === 'phone' && !bucket.phone) bucket.phone = m.value;
    else if (m.type === 'whatsapp' && !bucket.whatsapp) bucket.whatsapp = m.value;
    return acc;
  }, {});

  const rows: ContactRow[] = contactRows.map((c) => {
    const m = methodsByContact[c.id] ?? {};
    return {
      id: c.id,
      fullName: c.fullName,
      fullNameAr: c.fullNameAr,
      jobTitle: c.jobTitle,
      department: c.department,
      isPrimary: c.isPrimary,
      isDecisionMaker: c.isDecisionMaker,
      clientId: c.clientId,
      clientNameAr: c.clientNameAr,
      clientNameEn: c.clientNameEn,
      clientCode: c.clientCode,
      email: m.email ?? null,
      phone: m.phone ?? null,
      whatsapp: m.whatsapp ?? null,
    };
  });

  const total = rows.length;
  const primaries = rows.filter((r) => r.isPrimary).length;
  const decisionMakers = rows.filter((r) => r.isDecisionMaker).length;
  const noContactInfo = rows.filter((r) => !r.email && !r.phone && !r.whatsapp).length;

  // ?client= / ?flag= deep links become the directory's initial filters.
  const initialFilters: Record<string, string> = {};
  if (clientFilter) initialFilters.client = clientFilter;
  if (flagFilter) initialFilters.flag = flagFilter;

  const hints: AIHint[] = [];
  if (noContactInfo > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${noContactInfo} جهة اتصال بدون بريد أو هاتف`,
      insight: 'أضف وسيلة تواصل واحدة على الأقل لتفعيل التنبيهات والمتابعة.',
    });
  }
  if (total > 0 && decisionMakers === 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: 'لا يوجد صاحب قرار محدّد بين جهات الاتصال',
      insight: 'حدّد صاحب القرار لكل عميل لتسريع الموافقات والعروض.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · جهات الاتصال"
          headline={`${total} جهة اتصال · ${primaries} أساسية · ${decisionMakers} صاحب قرار`}
          hints={hints}
          compact
        />
      )}

      <PageHeader
        eyebrow="CRM"
        title="جهات الاتصال"
        subtitle={`${total} جهة اتصال عبر كل العملاء`}
        action={
          <Link
            href="/contacts/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            <UserPlus size={16} />
            جهة اتصال جديدة
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBox label="إجمالي" value={total} sub="جهة اتصال" icon={<Users size={16} />} />
        <StatBox
          label="أساسية"
          value={primaries}
          tone="default"
          sub="جهات الاتصال الأساسية"
          icon={<Star size={16} />}
        />
        <StatBox
          label="أصحاب قرار"
          value={decisionMakers}
          tone="default"
          sub="لهم سلطة الموافقة"
          icon={<Crown size={16} />}
        />
        <StatBox
          label="بدون تواصل"
          value={noContactInfo}
          tone={noContactInfo > 0 ? 'warning' : 'default'}
          sub="ينقصها بريد/هاتف"
          icon={<Mail size={16} />}
        />
      </section>

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={18} />}
            title="لا توجد جهات اتصال بعد"
            description="أضف أول جهة اتصال، أو أضِفها من صفحة العميل مباشرةً."
            action={
              <Link
                href="/contacts/new"
                className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                <UserPlus size={14} />
                جهة اتصال جديدة
              </Link>
            }
          />
        </Card>
      ) : (
        <ContactsDirectory
          rows={rows}
          initialFilters={Object.keys(initialFilters).length > 0 ? initialFilters : undefined}
        />
      )}
    </Shell>
  );
}
