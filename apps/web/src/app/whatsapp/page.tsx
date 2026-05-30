import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { MessageCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { canAny } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Thread = {
  threadKey: string;
  lastAt: string;
  cnt: number;
  lastBody: string | null;
  lastDir: string;
  lastType: string | null;
  senderName: string | null;
  matchedName: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  image: '📷 صورة',
  video: '🎬 فيديو',
  audio: '🎙️ رسالة صوتية',
  document: '📄 ملف',
  location: '📍 موقع',
};

function peerLabel(threadKey: string): string {
  if (threadKey.startsWith('group:')) return 'مجموعة';
  if (threadKey.startsWith('lid:')) return 'رقم محجوب (LID)';
  return threadKey;
}

export default async function WhatsappInboxPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/whatsapp');
  const ok = await canAny(['email_threads.read.all', 'email_threads.read.assigned']);
  if (!ok) redirect('/dashboard');

  const threads = rows<Thread>(
    await db.execute(sql`
      SELECT w.thread_key AS "threadKey",
             max(w.received_at) AS "lastAt",
             count(*)::int AS cnt,
             (SELECT body_text FROM whatsapp_messages x WHERE x.thread_key = w.thread_key
                ORDER BY received_at DESC LIMIT 1) AS "lastBody",
             (SELECT direction FROM whatsapp_messages x WHERE x.thread_key = w.thread_key
                ORDER BY received_at DESC LIMIT 1) AS "lastDir",
             (SELECT message_type FROM whatsapp_messages x WHERE x.thread_key = w.thread_key
                ORDER BY received_at DESC LIMIT 1) AS "lastType",
             (SELECT sender_name FROM whatsapp_messages x WHERE x.thread_key = w.thread_key
                AND sender_name IS NOT NULL ORDER BY received_at DESC LIMIT 1) AS "senderName",
             (SELECT COALESCE(c.full_name, p.display_name)
                FROM whatsapp_messages x
                LEFT JOIN contacts c ON c.id = x.matched_contact_id
                LEFT JOIN profiles p ON p.id = x.matched_profile_id
                WHERE x.thread_key = w.thread_key
                  AND (x.matched_contact_id IS NOT NULL OR x.matched_profile_id IS NOT NULL)
                ORDER BY received_at DESC LIMIT 1) AS "matchedName"
      FROM whatsapp_messages w
      WHERE w.thread_key IS NOT NULL
      GROUP BY w.thread_key
      ORDER BY max(w.received_at) DESC
      LIMIT 80`),
  );

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/inbox">
      <PageHeader
        eyebrow="WhatsApp"
        title="محادثات الواتساب"
        subtitle={`${threads.length} محادثة على خط الفريق`}
      />

      <Card padded={false} className="overflow-hidden">
        {threads.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={20} />}
            title="لا محادثات بعد"
            description="ستظهر المحادثات هنا عند وصول أول رسالة على خط Volt."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {threads.map((t) => (
              <li key={t.threadKey}>
                <Link
                  href={`/whatsapp/${encodeURIComponent(t.threadKey)}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--surface-hover)]"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)]">
                    <MessageCircle size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      {/* Real name first (matched contact/profile → WhatsApp
                          display name), with the raw key as a quiet sub-label. */}
                      <span className="min-w-0 truncate text-[13px] font-medium text-[var(--text)]">
                        <span dir={t.matchedName || t.senderName ? 'rtl' : 'ltr'}>
                          {t.matchedName ?? t.senderName ?? peerLabel(t.threadKey)}
                        </span>
                        {(t.matchedName || t.senderName) && (
                          <span className="ms-2 font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
                            {peerLabel(t.threadKey)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)]">
                        {new Date(t.lastAt).toISOString().slice(5, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {t.lastDir === 'outbound' ? (
                        <ArrowUpRight size={11} className="shrink-0 text-[var(--accent)]" />
                      ) : (
                        <ArrowDownLeft size={11} className="shrink-0 text-[var(--text-dim)]" />
                      )}
                      <span className="truncate text-[12px] text-[var(--text-muted)]">
                        {t.lastType && t.lastType !== 'text'
                          ? TYPE_LABEL[t.lastType] ?? t.lastType
                          : t.lastBody ?? '—'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-dim)]">
                    {t.cnt}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
