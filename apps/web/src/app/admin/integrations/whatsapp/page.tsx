import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getAdminUser } from '@/lib/auth-admin';
import { db, whatsappMessages } from '@antagna/db';
import { desc, sql } from 'drizzle-orm';
import { MessageCircle, Phone, AlertCircle } from 'lucide-react';
import { ConnectionPanel } from './connection-panel';

export const dynamic = 'force-dynamic';

export default async function WhatsAppIntegrationsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/integrations/whatsapp');

  // Are the env vars configured? (No live call to Evolution at SSR time —
  // the client panel handles that so a down Evolution doesn't break the page.)
  const apiUrl = process.env.WHATSAPP_API_URL ?? null;
  const apiKeySet = !!process.env.WHATSAPP_API_KEY;
  const ourE164 = process.env.WHATSAPP_OUR_E164 ?? null;

  // Quick stats from the DB.
  const stats = await db.execute<{
    total: number;
    inbound: number;
    outbound: number;
    last_at: Date | null;
  }>(sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE direction = 'inbound')::int AS inbound,
      count(*) FILTER (WHERE direction = 'outbound')::int AS outbound,
      max(received_at) AS last_at
    FROM whatsapp_messages
  `);
  const s = (stats as unknown as { total: number; inbound: number; outbound: number; last_at: Date | null }[])[0];

  // Last 10 messages — for the activity preview.
  const recent = await db
    .select({
      id: whatsappMessages.id,
      direction: whatsappMessages.direction,
      fromE164: whatsappMessages.fromE164,
      toE164: whatsappMessages.toE164,
      bodyText: whatsappMessages.bodyText,
      messageType: whatsappMessages.messageType,
      receivedAt: whatsappMessages.receivedAt,
    })
    .from(whatsappMessages)
    .orderBy(desc(whatsappMessages.receivedAt))
    .limit(10);

  // Unrecognized senders: inbound from_e164 values that aren't linked to
  // Team members self-link via /settings/whatsapp. No admin panel here
  // for picking unrecognized senders — that path led to the LID landing
  // in the wrong column (whatsapp_e164 instead of whatsapp_lid).

  const envReady = !!apiUrl && apiKeySet;

  return (
    <Shell user={{ email: admin.user.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإدارة
      </Link>

      <PageHeader
        eyebrow="Integrations · WhatsApp"
        title="ربط WhatsApp"
        subtitle="Evolution API لوكال + Cloudflare Tunnel. الرسائل تخش على نفس /inbox مع الإيميلات."
      />

      {!envReady && (
        <Card className="border-[var(--warning)]/40 bg-[var(--warning)]/[0.05]">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 text-[var(--warning)]" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--warning)]">
                Env vars غير مكتملة
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                لازم تظبط في Vercel:
              </p>
              <ul className="mt-2 list-inside list-disc text-[11px] text-[var(--text-muted)] font-mono">
                <li>WHATSAPP_API_URL {apiUrl ? '✓' : '✗ — مفقود'}</li>
                <li>WHATSAPP_API_KEY {apiKeySet ? '✓' : '✗ — مفقود'}</li>
                <li>WHATSAPP_OUR_E164 {ourE164 ? '✓ ' + ourE164 : '✗ — مفقود (الرقم الذي تُجري الـ pair به)'}</li>
              </ul>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                دليل الإعداد:{' '}
                <span className="font-mono">infra/whatsapp/README.md</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      <ConnectionPanel envReady={envReady} ourNumber={ourE164} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            إجمالي الرسائل
          </p>
          <p className="mt-1 font-mono text-[24px] text-[var(--text)]">
            {s?.total ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            وارد
          </p>
          <p className="mt-1 font-mono text-[24px] text-[var(--text)]">
            {s?.inbound ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            صادر
          </p>
          <p className="mt-1 font-mono text-[24px] text-[var(--text)]">
            {s?.outbound ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            آخر رسالة
          </p>
          <p className="mt-1 font-mono text-[12px] text-[var(--text)]">
            {s?.last_at
              ? new Date(s.last_at).toISOString().slice(0, 19).replace('T', ' ')
              : '—'}
          </p>
        </Card>
      </div>

      <Card>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          آخر 10 رسائل
        </p>
        {recent.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={20} />}
            title="لا رسائل بعد"
            description="بعد عمل pair للرقم ووصول أول رسالة، ستظهر هنا."
          />
        ) : (
          <ul className="space-y-1.5">
            {recent.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)]/40 p-2.5"
              >
                <StatusPill tone={m.direction === 'inbound' ? 'info' : 'success'}>
                  {m.direction === 'inbound' ? '↓ وارد' : '↑ صادر'}
                </StatusPill>
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <Phone size={11} />
                    <span className="font-mono">
                      {m.direction === 'inbound' ? m.fromE164 : m.toE164}
                    </span>
                    <span className="text-[var(--text-dim)]">·</span>
                    <span>{m.messageType}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text)]">
                    {m.bodyText ?? '(لا يوجد نص)'}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                  {new Date(m.receivedAt).toISOString().slice(11, 19)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
