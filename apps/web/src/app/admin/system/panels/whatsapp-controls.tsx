'use client';

import { useState, useTransition } from 'react';
import { Save, Send, Loader2 } from 'lucide-react';
import { saveWhatsappSettings, sendTestWhatsapp } from '../actions';
import {
  WHATSAPP_TOOLS,
  type WhatsappSettings,
  type WhatsappReplyMode,
} from '@/lib/whatsapp-settings';

const MODES: { v: WhatsappReplyMode; l: string; d: string }[] = [
  { v: 'auto', l: 'يرد تلقائياً', d: 'يولّد الرد ويبعته فوراً' },
  { v: 'draft', l: 'مسودة فقط', d: 'يولّد الرد لكن لا يبعته (للمراجعة)' },
  { v: 'off', l: 'موقوف', d: 'يستقبل ويسجّل بدون أي رد' },
];

export function WhatsappControls({
  initial,
  positions,
  registered,
  canManage,
}: {
  initial: WhatsappSettings;
  positions: { key: string; nameAr: string }[];
  registered: { name: string; e164: string }[];
  canManage: boolean;
}) {
  const [s, setS] = useState<WhatsappSettings>(initial);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  const [testTo, setTestTo] = useState(registered[0]?.e164 ?? '');
  const [testBody, setTestBody] = useState('اختبار من Antagna ✅');
  const [testing, startTest] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const everyone = s.allowedPositions.includes('*');
  const dis = !canManage;

  function set<K extends keyof WhatsappSettings>(k: K, v: WhatsappSettings[K]) {
    setS((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }
  function toggleTool(k: string) {
    setS((p) => ({ ...p, tools: { ...p.tools, [k]: !p.tools[k] } }));
    setSaved(false);
  }
  function togglePosition(k: string) {
    setS((p) => {
      const cur = p.allowedPositions.filter((x) => x !== '*');
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      return { ...p, allowedPositions: next.length ? next : ['*'] };
    });
    setSaved(false);
  }

  function save() {
    startSave(async () => {
      await saveWhatsappSettings(s);
      setSaved(true);
    });
  }
  function runTest() {
    setTestMsg(null);
    startTest(async () => {
      const r = await sendTestWhatsapp(testTo, testBody);
      setTestMsg(r.ok ? '✅ أُرسلت' : `❌ ${r.error ?? 'فشل'}`);
    });
  }

  const label = 'block text-[12px] font-medium text-[var(--text)]';
  const card = 'rounded-xl border border-[var(--line)] bg-[var(--surface)]/40 p-4';

  return (
    <div className="space-y-4">
      {/* Master + reply mode */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-[var(--text)]">تشغيل البوت</p>
            <p className="text-[11px] text-[var(--text-dim)]">المفتاح الرئيسي — لو موقوف، البوت لا يعمل إطلاقاً.</p>
          </div>
          <button
            type="button"
            disabled={dis}
            onClick={() => set('enabled', !s.enabled)}
            className={
              'relative h-7 w-12 rounded-full transition ' +
              (s.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong,#444)]') +
              (dis ? ' opacity-50' : '')
            }
          >
            <span className={'absolute top-0.5 h-6 w-6 rounded-full bg-white transition ' + (s.enabled ? 'start-0.5' : 'end-0.5')} />
          </button>
        </div>

        <div className="mt-4">
          <span className={label}>أسلوب الرد</span>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.v}
                type="button"
                disabled={dis}
                onClick={() => set('replyMode', m.v)}
                className={
                  'rounded-lg border p-2.5 text-start ' +
                  (s.replyMode === m.v
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--line)] bg-[var(--bg-elevated)] hover:border-[var(--line-strong)]')
                }
              >
                <p className="text-[12px] font-semibold text-[var(--text)]">{m.l}</p>
                <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">{m.d}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Persona / tone */}
      <div className={card}>
        <span className={label}>الشخصية ونبرة الرد (تُضاف لتعليمات النظام)</span>
        <textarea
          rows={4}
          disabled={dis}
          value={s.persona}
          onChange={(e) => set('persona', e.target.value)}
          placeholder="مثال: ردّ باختصار شديد، بالعربية الفصحى، وبنبرة رسمية. لا تستخدم إيموجي."
          className="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {/* Capabilities / tools */}
      <div className={card}>
        <span className={label}>القدرات (الأدوات المتاحة للبوت)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {WHATSAPP_TOOLS.map((t) => {
            const on = s.tools[t.key] !== false;
            return (
              <button
                key={t.key}
                type="button"
                disabled={dis}
                onClick={() => toggleTool(t.key)}
                className={
                  'rounded-full border px-3 py-1 text-[11px] ' +
                  (on
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]')
                }
              >
                {on ? '✓ ' : ''}{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Allowed positions */}
      <div className={card}>
        <span className={label}>مَن يقدر يستخدمه</span>
        <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">يرد فقط للمسجّلين بأرقامهم؛ هنا تقيّده أكثر حسب المنصب.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={dis}
            onClick={() => set('allowedPositions', ['*'])}
            className={'rounded-full border px-3 py-1 text-[11px] ' + (everyone ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]')}
          >
            {everyone ? '✓ ' : ''}الجميع (المسجّلون)
          </button>
          {positions.map((p) => {
            const on = !everyone && s.allowedPositions.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                disabled={dis}
                onClick={() => togglePosition(p.key)}
                className={'rounded-full border px-3 py-1 text-[11px] ' + (on ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]')}
              >
                {on ? '✓ ' : ''}{p.nameAr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Model */}
      <div className={card}>
        <span className={label}>النموذج</span>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-dim)]">المزوّد</span>
            <select disabled={dis} value={s.provider} onChange={(e) => set('provider', e.target.value as WhatsappSettings['provider'])} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[13px] text-[var(--text)]">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-dim)]">الموديل</span>
            <input disabled={dis} value={s.model} onChange={(e) => set('model', e.target.value)} placeholder="gpt-4o-mini" className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 font-mono text-[12px] text-[var(--text)]" />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-dim)]">حد التوكنات</span>
            <input disabled={dis} type="number" value={s.maxTokens} onChange={(e) => set('maxTokens', Number(e.target.value))} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 font-mono text-[12px] text-[var(--text)]" />
          </label>
        </div>
      </div>

      {/* Save */}
      {canManage && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} حفظ الإعدادات
          </button>
          {saved && <span className="text-[12px] text-[var(--success)]">✓ تم الحفظ</span>}
        </div>
      )}

      {/* Test send */}
      <div className={card}>
        <span className={label}>إرسال اختبار (من الإنتاج)</span>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[160px] flex-1 space-y-1">
            <span className="block text-[10px] text-[var(--text-dim)]">إلى</span>
            <select value={testTo} onChange={(e) => setTestTo(e.target.value)} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[13px] text-[var(--text)]">
              {registered.length === 0 && <option value="">لا أرقام مسجّلة</option>}
              {registered.map((r) => (
                <option key={r.e164} value={r.e164}>{r.name} · {r.e164}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[180px] flex-[2] space-y-1">
            <span className="block text-[10px] text-[var(--text-dim)]">النص</span>
            <input value={testBody} onChange={(e) => setTestBody(e.target.value)} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[13px] text-[var(--text)]" />
          </label>
          <button onClick={runTest} disabled={testing || !testTo} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50">
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} إرسال
          </button>
        </div>
        {testMsg && <p className="mt-2 text-[12px] text-[var(--text-muted)]">{testMsg}</p>}
      </div>

      {!canManage && (
        <p className="text-[11px] text-[var(--text-dim)]">عرض فقط — تحتاج صلاحية integration.manage للتعديل.</p>
      )}
    </div>
  );
}
