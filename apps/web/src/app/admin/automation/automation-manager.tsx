'use client';

import { useState, useTransition } from 'react';
import { Bell, BarChart3, Save, Power, Lock, Check } from 'lucide-react';
import { updateAlertRule, updateKpiDefinition } from '../alert-actions';

type Rule = {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  triggerType: string;
  triggerSpec: unknown;
  recipientStrategy: string;
  cooldownMinutes: number;
  active: boolean;
};
type Kpi = {
  key: string;
  nameAr: string;
  nameEn: string | null;
  scope: string;
  unit: string;
  computeSql: string | null;
  thresholdGreen: number | null;
  thresholdAmber: number | null;
  refreshFrequency: string;
  active: boolean;
};

const TABS = [
  { id: 'rules', label: 'قواعد التنبيهات', icon: Bell },
  { id: 'kpis', label: 'مؤشرات الأداء', icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]['id'];

const card = 'rounded-xl border border-white/[0.08] bg-[#17171C]';
const field =
  'h-8 w-full rounded-md border border-white/[0.1] bg-[#0F0F12] px-2.5 text-[13px] text-white/90 outline-none focus:border-[#FF6B1A]/60';
const lbl = 'text-[11px] font-medium text-white/40';

export function AutomationManager({ rules, kpis }: { rules: Rule[]; kpis: Kpi[] }) {
  const [tab, setTab] = useState<TabId>('rules');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-[#17171C] p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ' +
                (tab === t.id
                  ? 'bg-[#FF6B1A] text-black'
                  : 'text-white/60 hover:bg-white/[0.05] hover:text-white')
              }
            >
              <Icon size={13} />
              {t.label}
              <span className="opacity-50">
                {t.id === 'rules' ? rules.length : kpis.length}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 && (
            <p className="px-1 text-[13px] text-white/40">لا توجد قواعد تنبيه.</p>
          )}
          {rules.map((r) => (
            <RuleEditor key={r.id} rule={r} />
          ))}
        </div>
      )}

      {tab === 'kpis' && (
        <div className="space-y-3">
          {kpis.length === 0 && (
            <p className="px-1 text-[13px] text-white/40">لا توجد مؤشرات.</p>
          )}
          {kpis.map((k) => (
            <KpiEditor key={k.key} kpi={k} />
          ))}
        </div>
      )}
    </div>
  );
}

function Saved({ at }: { at: number | null }) {
  if (!at) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
      <Check size={12} /> حُفظ
    </span>
  );
}

function RuleEditor({ rule }: { rule: Rule }) {
  const [nameAr, setNameAr] = useState(rule.nameAr);
  const [nameEn, setNameEn] = useState(rule.nameEn ?? '');
  const [description, setDescription] = useState(rule.description ?? '');
  const [recipientStrategy, setRecipientStrategy] = useState(rule.recipientStrategy);
  const [cooldown, setCooldown] = useState(String(rule.cooldownMinutes));
  const [spec, setSpec] = useState(JSON.stringify(rule.triggerSpec ?? {}, null, 2));
  const [active, setActive] = useState(rule.active);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const res = await updateAlertRule({
        id: rule.id,
        nameAr,
        nameEn,
        description,
        recipientStrategy,
        cooldownMinutes: Number(cooldown),
        triggerSpec: spec,
        active,
      });
      if (res.ok) setSavedAt(Date.now());
      else setError(res.error ?? 'تعذّر الحفظ');
    });

  return (
    <div className={card + ' p-4'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/40">{rule.key}</span>
          <span className="rounded border border-white/[0.1] px-1.5 py-0.5 text-[10px] text-white/40">
            {rule.triggerType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Saved at={savedAt} />
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            title={active ? 'نشِط — اضغط للإيقاف' : 'متوقف — اضغط للتفعيل'}
            className={
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ' +
              (active
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-white/[0.1] bg-white/[0.02] text-white/40')
            }
          >
            <Power size={12} />
            {active ? 'نشِط' : 'متوقف'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={lbl}>الاسم (عربي)</span>
          <input className={field} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className={lbl}>Name (English)</span>
          <input
            className={field}
            dir="ltr"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={lbl}>الوصف</span>
          <input
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className={lbl}>المستقبِلون (recipient_strategy)</span>
          <input
            className={field}
            dir="ltr"
            value={recipientStrategy}
            onChange={(e) => setRecipientStrategy(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className={lbl}>فترة التهدئة (دقائق)</span>
          <input
            className={field}
            dir="ltr"
            type="number"
            min={0}
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={lbl}>trigger_spec (JSON)</span>
          <textarea
            dir="ltr"
            spellCheck={false}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            rows={Math.min(10, Math.max(3, spec.split('\n').length))}
            className="w-full rounded-md border border-white/[0.1] bg-[#0F0F12] p-2.5 font-mono text-[12px] leading-relaxed text-white/80 outline-none focus:border-[#FF6B1A]/60"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {error ? (
          <span className="text-[12px] text-red-400">{error}</span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#FF6B1A] px-3 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={13} />
          {pending ? 'يحفظ…' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}

function KpiEditor({ kpi }: { kpi: Kpi }) {
  const [nameAr, setNameAr] = useState(kpi.nameAr);
  const [nameEn, setNameEn] = useState(kpi.nameEn ?? '');
  const [green, setGreen] = useState(kpi.thresholdGreen?.toString() ?? '');
  const [amber, setAmber] = useState(kpi.thresholdAmber?.toString() ?? '');
  const [active, setActive] = useState(kpi.active);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await updateKpiDefinition({
        key: kpi.key,
        nameAr,
        nameEn,
        thresholdGreen: num(green),
        thresholdAmber: num(amber),
        active,
      });
      if (res.ok) setSavedAt(Date.now());
      else setError(res.error ?? 'تعذّر الحفظ');
    });

  return (
    <div className={card + ' p-4'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/40">{kpi.key}</span>
          <span className="rounded border border-white/[0.1] px-1.5 py-0.5 text-[10px] text-white/40">
            {kpi.scope} · {kpi.unit} · {kpi.refreshFrequency}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Saved at={savedAt} />
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className={
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ' +
              (active
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-white/[0.1] bg-white/[0.02] text-white/40')
            }
          >
            <Power size={12} />
            {active ? 'نشِط' : 'متوقف'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={lbl}>الاسم (عربي)</span>
          <input className={field} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className={lbl}>Name (English)</span>
          <input
            className={field}
            dir="ltr"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className={lbl}>حد الأخضر (threshold_green)</span>
          <input
            className={field}
            dir="ltr"
            type="number"
            step="any"
            value={green}
            onChange={(e) => setGreen(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className={lbl}>حد الأصفر (threshold_amber)</span>
          <input
            className={field}
            dir="ltr"
            type="number"
            step="any"
            value={amber}
            onChange={(e) => setAmber(e.target.value)}
          />
        </label>
      </div>

      {kpi.computeSql && (
        <div className="mt-3 space-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] text-white/30">
            <Lock size={11} /> compute_sql — مُدار بالكود (غير قابل للتعديل هنا)
          </span>
          <pre
            dir="ltr"
            className="max-h-28 overflow-auto rounded-md border border-white/[0.06] bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-white/40"
          >
            {kpi.computeSql}
          </pre>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {error ? <span className="text-[12px] text-red-400">{error}</span> : <span />}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#FF6B1A] px-3 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={13} />
          {pending ? 'يحفظ…' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
