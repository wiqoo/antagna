import { Card, CardHeader, StatBox, StatusPill, EmptyState } from '@antagna/ui';
import { CreditCard, Timer, AlertTriangle } from 'lucide-react';
import { SubsEditor } from './subs-editor';

interface Subscription {
  vendor: string;
  plan: string;
  renews_at: string | null;
  cost_usd: number;
}
interface CronRow {
  source: string;
  lastRun: string | null;
  beats: number;
}

const STALE_MS = 15 * 60 * 1000;

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
}

function ago(ts: string | null): string {
  if (!ts) return '—';
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `${mins} د`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} س`;
  return `${Math.round(hrs / 24)} يوم`;
}

export function SubsPanel({
  subscriptions,
  cron,
  canManage,
}: {
  subscriptions: Subscription[];
  cron: CronRow[];
  canManage: boolean;
}) {
  const monthlyTotal = subscriptions.reduce((sum, s) => sum + (Number(s.cost_usd) || 0), 0);
  const staleCount = cron.filter(
    (c) => !c.lastRun || Date.now() - new Date(c.lastRun).getTime() > STALE_MS,
  ).length;

  const usd = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox
          label="تكلفة الاشتراكات شهريًا"
          value={monthlyTotal}
          format={usd(monthlyTotal)}
          icon={<CreditCard size={16} />}
          sub={`${subscriptions.length} اشتراك`}
        />
        <StatBox label="مهام Cron" value={cron.length} icon={<Timer size={16} />} sub="cron_heartbeat" />
        <StatBox
          label="مهام متوقّفة"
          value={staleCount}
          icon={<AlertTriangle size={16} />}
          tone={staleCount > 0 ? 'danger' : 'success'}
          sub="آخر نبضة > 15 دقيقة"
        />
      </section>

      {/* Subscriptions editor */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader title="الاشتراكات" subtitle="system_settings · subscriptions (jsonb array)" />
        </div>
        <SubsEditor subscriptions={subscriptions} canManage={canManage} />
      </Card>

      {/* Cron heartbeat */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader title="نبضات Cron" subtitle="آخر تشغيل لكل مهمّة مجدولة" />
        </div>
        {cron.length === 0 ? (
          <EmptyState
            icon={<Timer size={20} />}
            title="لا نبضات بعد"
            description="بتظهر هنا بمجرّد ما الـ worker يبدأ يسجّل cron_heartbeat."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">المصدر</th>
                  <th className="px-5 py-3 text-start">آخر تشغيل</th>
                  <th className="px-5 py-3 text-start">منذ</th>
                  <th className="px-5 py-3 text-start">عدد النبضات</th>
                  <th className="px-5 py-3 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {cron.map((c) => {
                  const stale = !c.lastRun || Date.now() - new Date(c.lastRun).getTime() > STALE_MS;
                  return (
                    <tr key={c.source} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text)]">{c.source}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{fmt(c.lastRun)}</td>
                      <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{ago(c.lastRun)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{c.beats}</td>
                      <td className="px-5 py-3">
                        <StatusPill tone={stale ? 'danger' : 'success'}>
                          {stale ? 'متوقّف' : 'يعمل'}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
