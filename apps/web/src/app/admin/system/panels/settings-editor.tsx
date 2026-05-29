'use client';

import { useState, useTransition } from 'react';
import { StatusPill } from '@antagna/ui';
import { Loader2, Check, Plus } from 'lucide-react';
import { upsertSetting } from '../actions';

interface SettingRow {
  key: string;
  value: string; // pretty-printed JSON
  updatedAt: string;
}

function fmt(ts: string): string {
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
}

function EditableRow({
  settingKey,
  value,
  updatedAt,
  canManage,
}: {
  settingKey: string;
  value: string;
  updatedAt: string;
  canManage: boolean;
}) {
  const [val, setVal] = useState(value);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = val !== value;

  return (
    <div className="space-y-2 px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs font-semibold text-[var(--text)]">{settingKey}</span>
        <span className="font-mono text-[10px] text-[var(--text-dim)]">آخر تحديث {fmt(updatedAt)}</span>
      </div>
      <textarea
        value={val}
        disabled={!canManage}
        onChange={(e) => {
          setVal(e.target.value);
          setError(null);
          setSaved(false);
        }}
        rows={Math.min(8, Math.max(2, val.split('\n').length))}
        spellCheck={false}
        dir="ltr"
        className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--line-strong)] disabled:opacity-60"
      />
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {canManage && (
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              start(async () => {
                try {
                  JSON.parse(val);
                } catch {
                  setError('JSON غير صالح');
                  return;
                }
                await upsertSetting(settingKey, val);
                setSaved(true);
              })
            }
            disabled={pending || !dirty}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs hover:border-[var(--accent)] disabled:opacity-40"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            حفظ
          </button>
          {saved && !dirty && <span className="text-xs text-[var(--success)]">تم الحفظ</span>}
        </div>
      )}
    </div>
  );
}

export function SettingsEditor({
  settings,
  canManage,
}: {
  settings: SettingRow[];
  canManage: boolean;
}) {
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('{}');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
        {settings.map((s) => (
          <EditableRow
            key={s.key}
            settingKey={s.key}
            value={s.value}
            updatedAt={s.updatedAt}
            canManage={canManage}
          />
        ))}
        {settings.length === 0 && (
          <p className="px-6 py-6 text-center text-xs text-[var(--text-muted)]">لا إعدادات بعد.</p>
        )}
      </div>

      {canManage && (
        <div className="space-y-2 border-t border-[var(--line)] bg-[var(--bg-elevated)]/40 px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            إضافة / استبدال مفتاح
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="setting.key"
              dir="ltr"
              className="h-9 w-56 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 font-mono text-xs text-[var(--text)] outline-none"
            />
            <textarea
              value={newVal}
              onChange={(e) => {
                setNewVal(e.target.value);
                setError(null);
              }}
              rows={2}
              dir="ltr"
              spellCheck={false}
              placeholder='{"example": true}'
              className="min-w-[16rem] flex-1 resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 font-mono text-xs text-[var(--text)] outline-none"
            />
            <button
              onClick={() => {
                if (!newKey.trim()) {
                  setError('المفتاح مطلوب');
                  return;
                }
                try {
                  JSON.parse(newVal);
                } catch {
                  setError('JSON غير صالح');
                  return;
                }
                start(async () => {
                  await upsertSetting(newKey, newVal);
                  setNewKey('');
                  setNewVal('{}');
                });
              }}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              حفظ
            </button>
          </div>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        </div>
      )}

      {!canManage && (
        <div className="border-t border-[var(--line)] px-6 py-3">
          <StatusPill tone="neutral">عرض فقط — تحتاج صلاحية settings.update للتعديل</StatusPill>
        </div>
      )}
    </div>
  );
}
