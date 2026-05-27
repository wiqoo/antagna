import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { WhatsappComposer } from './composer';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Msg = {
  id: string;
  direction: string;
  bodyText: string | null;
  messageType: string | null;
  mediaUrl: string | null;
  fromE164: string | null;
  receivedAt: string;
};

function peerLabel(threadKey: string): string {
  if (threadKey.startsWith('group:')) return 'مجموعة';
  if (threadKey.startsWith('lid:')) return 'رقم محجوب (LID)';
  return threadKey;
}

export default async function WhatsappThreadPage({
  params,
}: {
  params: Promise<{ thread: string }>;
}) {
  const { thread } = await params;
  const threadKey = decodeURIComponent(thread);

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/whatsapp/${thread}`);

  const messages = rows<Msg>(
    await db.execute(sql`
      SELECT id::text AS id, direction, body_text AS "bodyText",
             message_type AS "messageType", media_url AS "mediaUrl",
             from_e164 AS "fromE164", received_at AS "receivedAt"
      FROM whatsapp_messages
      WHERE thread_key = ${threadKey}
      ORDER BY received_at ASC
      LIMIT 300`),
  );

  // The number we can actually send to: the thread key if it's a phone, else
  // the most recent real +E.164 we've seen inbound (LID threads may not resolve).
  let toE164: string | null = threadKey.startsWith('+') ? threadKey : null;
  if (!toE164) {
    const inbound = [...messages]
      .reverse()
      .find((m) => m.direction === 'inbound' && m.fromE164?.startsWith('+'));
    toE164 = inbound?.fromE164 ?? null;
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/inbox">
      <Link
        href="/whatsapp"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> المحادثات
      </Link>

      <PageHeader
        eyebrow="WhatsApp"
        title={peerLabel(threadKey)}
        subtitle={`${messages.length} رسالة`}
      />

      <Card padded={false} className="flex flex-col overflow-hidden">
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[var(--text-dim)]">
              لا رسائل في هذه المحادثة.
            </p>
          ) : (
            messages.map((m) => {
              const out = m.direction === 'outbound';
              return (
                <div
                  key={m.id}
                  className={'flex ' + (out ? 'justify-start' : 'justify-end')}
                >
                  <div
                    className={
                      'max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ' +
                      (out
                        ? 'bg-[var(--accent)]/15 text-[var(--text)]'
                        : 'border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--text)]')
                    }
                  >
                    {m.messageType && m.messageType !== 'text' && (
                      <span className="mb-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <ImageIcon size={11} /> {m.messageType}
                        {m.mediaUrl && (
                          <a
                            href={m.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--accent)] hover:underline"
                            dir="ltr"
                          >
                            فتح
                          </a>
                        )}
                      </span>
                    )}
                    {m.bodyText && <p className="whitespace-pre-wrap break-words">{m.bodyText}</p>}
                    <p className="mt-1 text-end font-mono text-[9px] text-[var(--text-dim)]">
                      {new Date(m.receivedAt).toISOString().slice(11, 16)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <WhatsappComposer threadKey={threadKey} toE164={toE164} />
      </Card>
    </Shell>
  );
}
