import { Card, CardHeader, StatBox, EmptyState } from '@antagna/ui';
import { DollarSign, Cpu, Layers, PiggyBank } from 'lucide-react';
import { BudgetEditor } from './budget-editor';
import { UserLimitsEditor } from './user-limits-editor';

interface GroupRow {
  cost: number;
  calls: number;
}
interface FeatureRow extends GroupRow {
  feature: string;
}
interface ModelRow extends GroupRow {
  model: string;
}
interface CacheRow {
  cache_read: string;
  cache_write: string;
  input_tokens: string;
}
interface LimitRow {
  userId: string;
  name: string | null;
  email: string | null;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  hardCap: boolean;
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Bars<T extends GroupRow>({ rows, label }: { rows: T[]; label: (r: T) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.cost));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const lbl = label(r);
        const pct = Math.max(2, Math.round((r.cost / max) * 100));
        return (
          <li key={`${lbl}-${i}`} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[var(--text)]">{lbl}</span>
              <span className="text-[var(--text-muted)]">
                {usd(r.cost)} · {r.calls} call{r.calls === 1 ? '' : 's'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CostPanel({
  mtdTotal,
  byFeature,
  byModel,
  cache,
  limits,
  allUsers,
  monthlyBudget,
  canManage,
}: {
  mtdTotal: number;
  byFeature: FeatureRow[];
  byModel: ModelRow[];
  cache: CacheRow | null;
  limits: LimitRow[];
  allUsers: { id: string; name: string; email: string }[];
  monthlyBudget: number;
  canManage: boolean;
}) {
  const cacheRead = Number(cache?.cache_read ?? 0);
  const cacheWrite = Number(cache?.cache_write ?? 0);
  const inputTokens = Number(cache?.input_tokens ?? 0);
  // Cache reads cost ~10% of a fresh input token → ~0.9× saved per cached token.
  const cachedTotal = cacheRead + inputTokens;
  const cacheHitPct = cachedTotal > 0 ? Math.round((cacheRead / cachedTotal) * 100) : 0;

  const overBudget = monthlyBudget > 0 && mtdTotal > monthlyBudget;
  const budgetPct = monthlyBudget > 0 ? Math.min(100, Math.round((mtdTotal / monthlyBudget) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox
          label="تكلفة هذا الشهر"
          value={mtdTotal}
          format={usd(mtdTotal)}
          icon={<DollarSign size={16} />}
          tone={overBudget ? 'danger' : 'default'}
          sub={
            monthlyBudget > 0
              ? `من ميزانية ${usd(monthlyBudget)} (${budgetPct}%)`
              : 'لا توجد ميزانية محدّدة'
          }
        />
        <StatBox
          label="قراءات الكاش"
          value={cacheRead}
          icon={<PiggyBank size={16} />}
          tone="success"
          sub={`${cacheHitPct}% من مدخلات الكاش · write ${cacheWrite.toLocaleString('en-US')}`}
        />
        <StatBox
          label="عدد النماذج النشطة"
          value={byModel.length}
          icon={<Cpu size={16} />}
          sub={`${byFeature.length} ميزة تستهلك AI`}
        />
      </section>

      {overBudget && (
        <Card className="border-[var(--danger)]/40 bg-[var(--danger-tint)]">
          <p className="text-sm font-semibold text-[var(--danger)]">
            تجاوزت الميزانية الشهرية — {usd(mtdTotal)} من {usd(monthlyBudget)}.
          </p>
        </Card>
      )}

      {/* Budget editor */}
      <Card>
        <CardHeader title="الميزانية الشهرية" subtitle="system_settings · ai.monthly_budget_usd" />
        <div className="mt-4">
          <BudgetEditor current={monthlyBudget} canManage={canManage} />
        </div>
      </Card>

      {/* Breakdowns */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="حسب الميزة" subtitle="MTD · SUM(cost_usd)" />
          <div className="mt-4">
            {byFeature.length === 0 ? (
              <EmptyState icon={<Layers size={18} />} title="لا استهلاك بعد هذا الشهر" description="" />
            ) : (
              <Bars rows={byFeature} label={(r) => r.feature} />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="حسب النموذج" subtitle="MTD · SUM(cost_usd)" />
          <div className="mt-4">
            {byModel.length === 0 ? (
              <EmptyState icon={<Cpu size={18} />} title="لا استهلاك بعد هذا الشهر" description="" />
            ) : (
              <Bars rows={byModel} label={(r) => r.model} />
            )}
          </div>
        </Card>
      </section>

      {/* Per-user limits */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="حدود الاستهلاك لكل مستخدم"
            subtitle="حد يومي/شهري + قفل صارم (hard cap يوقف الطلبات عند التجاوز)"
          />
        </div>
        <UserLimitsEditor limits={limits} allUsers={allUsers} canManage={canManage} />
      </Card>
    </div>
  );
}
