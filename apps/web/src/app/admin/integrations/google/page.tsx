import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { db, googleIntegrations } from '@antagna/db';
import { PageHeader, Card, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import {
  Mail,
  FolderOpen,
  Calendar as CalendarIcon,
  Plug,
  Power,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { getAdminUser } from '@/lib/auth-admin';
import { TestPanel } from './test-panel';
import { SyncPanel } from './sync-panel';

export const dynamic = 'force-dynamic';

export default async function GoogleIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/integrations/google');
  const { user } = admin;

  const rows = await db
    .select()
    .from(googleIntegrations)
    .orderBy(desc(googleIntegrations.connectedAt));

  const active = rows.filter((r) => r.disconnectedAt == null);
  const past = rows.filter((r) => r.disconnectedAt != null);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإدارة
      </Link>

      <PageHeader
        eyebrow="Integrations · Google"
        title="ربط Google"
        subtitle="اربط حساب Google واحد (مثل info@voltsaudi.com) ليقرأ Gmail ويعدّل Drive و Calendar."
        action={
          <Link
            href="/api/auth/google/connect"
            className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white"
            style={{ background: 'var(--accent-gradient)' }}
          >
            <Plug size={14} />
            {active.length === 0 ? 'اربط Google' : 'اربط حساب آخر'}
          </Link>
        }
      />

      {/* Flash messages */}
      {sp.error && (
        <Card className="border-[var(--danger)]/40 bg-[var(--danger)]/[0.05]">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 text-[var(--danger)]" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--danger)]">فشل الربط</p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{sp.error}</p>
            </div>
          </div>
        </Card>
      )}
      {sp.connected && (
        <Card className="border-[var(--success)]/40 bg-[var(--success)]/[0.05]">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--success)]" />
            <p className="text-[13px] text-[var(--success)]">
              تم الربط بنجاح مع <span className="font-mono">{sp.connected}</span>. جرّب الاختبارات بالأسفل.
            </p>
          </div>
        </Card>
      )}
      {sp.disconnected && (
        <Card className="border-[var(--warning)]/40 bg-[var(--warning)]/[0.05]">
          <p className="text-[13px] text-[var(--warning)]">تم فصل الحساب.</p>
        </Card>
      )}

      {/* Active integrations */}
      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Plug size={20} />}
            title="لا يوجد حساب Google مربوط"
            description="اضغط على «اربط Google» بالأعلى لبدء عملية المصادقة. سيُطلب منك تسجيل الدخول بحساب info@voltsaudi.com والموافقة على الصلاحيات."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {active.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-[var(--accent)]" />
                    <h2 className="text-[16px] font-semibold text-[var(--text)]">{row.email}</h2>
                    <StatusPill tone="success">متصل</StatusPill>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[11px] text-[var(--text-muted)] md:grid-cols-3">
                    <span>
                      <span className="text-[var(--text-dim)]">منذ:</span>{' '}
                      {new Date(row.connectedAt).toISOString().slice(0, 10)}
                    </span>
                    <span>
                      <span className="text-[var(--text-dim)]">آخر تحديث:</span>{' '}
                      {new Date(row.lastRefreshedAt).toISOString().slice(0, 19).replace('T', ' ')}
                    </span>
                    <span>
                      <span className="text-[var(--text-dim)]">ينتهي الـ access:</span>{' '}
                      {new Date(row.expiresAt).toISOString().slice(11, 19)}
                    </span>
                  </div>
                  {row.lastError && (
                    <p className="text-[11px] text-[var(--danger)]">⚠ آخر خطأ: {row.lastError}</p>
                  )}
                </div>
                <form action="/api/auth/google/disconnect" method="POST">
                  <input type="hidden" name="email" value={row.email} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--danger)] hover:border-[var(--danger)]"
                  >
                    <Power size={13} />
                    افصل
                  </button>
                </form>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                <ScopeBadge
                  icon={<Mail size={13} />}
                  label="Gmail (قراءة)"
                  granted={row.scope.includes('gmail.readonly')}
                />
                <ScopeBadge
                  icon={<FolderOpen size={13} />}
                  label="Drive (قراءة + تعديل)"
                  granted={row.scope.includes('auth/drive')}
                />
                <ScopeBadge
                  icon={<CalendarIcon size={13} />}
                  label="Calendar (قراءة + تعديل)"
                  granted={row.scope.includes('auth/calendar')}
                />
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <TestPanel email={row.email} />
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <SyncPanel email={row.email} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Past integrations (small) */}
      {past.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            — تاريخ
          </p>
          <ul className="space-y-1.5">
            {past.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)]/60 px-3 py-2 text-[11px] text-[var(--text-muted)]"
              >
                <span className="font-mono">{row.email}</span>
                <span className="text-[var(--text-dim)]">·</span>
                <span>
                  مفصول {row.disconnectedAt && new Date(row.disconnectedAt).toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

function ScopeBadge({
  icon,
  label,
  granted,
}: {
  icon: React.ReactNode;
  label: string;
  granted: boolean;
}) {
  return (
    <div
      className={
        'flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] ' +
        (granted
          ? 'border-[var(--success)]/30 bg-[var(--success)]/[0.05] text-[var(--text)]'
          : 'border-[var(--line)] bg-[var(--surface)]/40 text-[var(--text-dim)]')
      }
    >
      <span style={{ color: granted ? 'var(--success)' : 'var(--text-dim)' }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {granted ? (
        <CheckCircle2 size={13} className="text-[var(--success)]" />
      ) : (
        <span className="text-[10px]">—</span>
      )}
    </div>
  );
}
