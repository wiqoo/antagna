import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, StatBox } from '@antagna/ui';
import { Bell, BellRing, CheckCircle2, Inbox } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getEffectiveProfileId } from '@/lib/authz';
import { NotificationsList, type NotifRow } from './NotificationsList';

export const dynamic = 'force-dynamic';

type Raw = {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  entity_type: string | null;
  event_type_key: string | null;
  category: string | null;
  category_label: string | null;
  read_at: Date | null;
  created_at: Date;
};

export default async function NotificationsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/notifications');

  // View-as aware effective profile — notifications are scoped to the recipient.
  const pid = await getEffectiveProfileId();
  if (!pid) redirect('/login?next=/notifications');

  // Join event types for a human category label (Arabic). LEFT JOIN so rows with
  // a null / unknown event_type_key still show.
  const raw = (await db.execute<Raw>(sql`
    SELECT
      n.id::text          AS id,
      n.title             AS title,
      n.body              AS body,
      n.link_url          AS link_url,
      n.entity_type       AS entity_type,
      n.event_type_key    AS event_type_key,
      et.category         AS category,
      COALESCE(et.name_ar, et.category) AS category_label,
      n.read_at           AS read_at,
      n.created_at        AS created_at
    FROM notifications n
    LEFT JOIN notification_event_types et ON et.key = n.event_type_key
    WHERE n.recipient_id = ${pid}::uuid
    ORDER BY n.created_at DESC
    LIMIT 200
  `)) as unknown as Raw[];

  const rows: NotifRow[] = raw.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    linkUrl: r.link_url,
    entityType: r.entity_type,
    eventTypeKey: r.event_type_key,
    category: r.category,
    categoryLabel: r.category_label,
    read: !!r.read_at,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const total = rows.length;
  const unread = rows.filter((r) => !r.read).length;
  const read = total - unread;
  const today = rows.filter(
    (r) => new Date(r.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/notifications">
      <PageHeader
        eyebrow="التنبيهات"
        title="مركز الإشعارات"
        subtitle="كل ما يخصّك — مشاريع، مهام، معدات، موافقات ومراجعات — في مكان واحد."
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox label="الإجمالي" value={total} sub="إشعار" icon={<Bell size={16} />} />
        <StatBox
          label="غير مقروء"
          value={unread}
          tone={unread > 0 ? 'warning' : 'default'}
          sub={unread > 0 ? 'بانتظار مراجعتك' : 'لا جديد'}
          icon={<BellRing size={16} />}
        />
        <StatBox
          label="مقروء"
          value={read}
          tone="success"
          sub="تمّت مراجعته"
          icon={<CheckCircle2 size={16} />}
        />
        <StatBox label="اليوم" value={today} sub="خلال اليوم" icon={<Inbox size={16} />} />
      </section>

      <Card>
        <NotificationsList rows={rows} />
      </Card>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Notifications</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
