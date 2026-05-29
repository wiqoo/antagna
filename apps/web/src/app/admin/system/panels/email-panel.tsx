import Link from 'next/link';
import { Card, CardHeader, StatBox, StatusPill } from '@antagna/ui';
import { Mail, Filter, ChevronLeft, AlertTriangle } from 'lucide-react';
import { InboundToggle } from './inbound-toggle';

interface SyncRow {
  lastOk: string | null;
  lastError: string | null;
  errors24h: number;
  lastErrorMsg: string | null;
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
}

export function EmailPanel({
  inboundEnabled,
  sync,
  activeRoutes,
  canManage,
}: {
  inboundEnabled: boolean;
  sync: SyncRow | null;
  activeRoutes: number;
  canManage: boolean;
}) {
  const errors = sync?.errors24h ?? 0;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardHeader
            title="البريد الوارد (Inbound)"
            subtitle="عند التفعيل، الـ worker بيسحب الإيميلات الجديدة ويمرّرها على قواعد التوجيه + ملخّص الـ AI."
          />
          <InboundToggle enabled={inboundEnabled} canManage={canManage} />
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox
          label="الحالة"
          value={inboundEnabled ? 1 : 0}
          format={inboundEnabled ? 'مُفعّل' : 'موقوف'}
          icon={<Mail size={16} />}
          tone={inboundEnabled ? 'success' : 'default'}
        />
        <StatBox
          label="قواعد توجيه نشطة"
          value={activeRoutes}
          icon={<Filter size={16} />}
          sub="inbound_email_routes"
        />
        <StatBox
          label="أخطاء آخر 24 ساعة"
          value={errors}
          icon={<AlertTriangle size={16} />}
          tone={errors > 0 ? 'danger' : 'success'}
          sub={errors > 0 ? 'راجِع integration_log' : 'لا أخطاء'}
        />
      </section>

      <Card>
        <CardHeader title="حالة المزامنة (Gmail / Google)" subtitle="من integration_log" />
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              آخر مزامنة ناجحة
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--text)]">{fmt(sync?.lastOk ?? null)}</dd>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              آخر خطأ
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--text)]">{fmt(sync?.lastError ?? null)}</dd>
            {sync?.lastErrorMsg && (
              <p className="mt-1 max-w-full truncate text-[11px] text-[var(--danger)]">
                {sync.lastErrorMsg}
              </p>
            )}
          </div>
        </dl>
      </Card>

      <Card>
        <Link
          href="/admin/integrations/email-routes"
          className="group flex items-center gap-3 rounded-lg p-1"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)] group-hover:text-[var(--accent)]">
            <Filter size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text)]">قواعد توجيه البريد</p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              حرّر القواعد اللي بتوزّع كل thread وارد — {activeRoutes} قاعدة نشطة
            </p>
          </div>
          <ChevronLeft
            size={16}
            className="shrink-0 text-[var(--text-dim)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]"
          />
        </Link>
      </Card>

      {!canManage && (
        <StatusPill tone="neutral">عرض فقط — تحتاج صلاحية integration.manage للتعديل</StatusPill>
      )}
    </div>
  );
}
