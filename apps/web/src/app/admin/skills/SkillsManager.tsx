'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Plus,
  Power,
  Pencil,
  ChevronUp,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { StatusPill, EmptyState } from '@antagna/ui';
import { createSkill, updateSkill, toggleSkillActive, reorderSkill } from './actions';

export type SkillRow = {
  key: string;
  nameAr: string;
  nameEn: string;
  category: string | null;
  description: string | null;
  iconKey: string | null;
  active: boolean;
  position: number;
  usageCount: number;
};

const CATEGORIES = [
  { value: 'production', label: 'إنتاج' },
  { value: 'post', label: 'ما بعد الإنتاج' },
  { value: 'business', label: 'أعمال' },
  { value: 'admin', label: 'إداري' },
] as const;

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

const CAT_TONE: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  production: 'success',
  post: 'info',
  business: 'warning',
  admin: 'neutral',
};

const field =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';

export function SkillsManager({ skills }: { skills: SkillRow[] }) {
  const [editing, setEditing] = useState<SkillRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [, start] = useTransition();

  const sorted = useMemo(
    () => [...skills].sort((a, b) => a.position - b.position || a.key.localeCompare(b.key)),
    [skills],
  );

  if (skills.length === 0) {
    return (
      <>
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} />
            مهارة جديدة
          </button>
        </div>
        <EmptyState
          icon={<Sparkles size={20} />}
          title="لا مهارات في الكتالوج بعد"
          description="كتالوج المهارات يحدّد القدرات الإنتاجية (مصوّر، مونتير، طيّار درون…) التي تُسنَد لأعضاء الفريق. أضف أول مهارة لتبدأ."
          action={
            <button
              onClick={() => setCreating(true)}
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={14} />
              مهارة جديدة
            </button>
          }
        />
        {creating && (
          <SkillDialog
            mode="create"
            onClose={() => setCreating(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">
          {skills.length} مهارة · {skills.filter((s) => s.active).length} نشطة
        </p>
        <button
          onClick={() => setCreating(true)}
          className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          <Plus size={14} />
          مهارة جديدة
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
              <th className="px-4 py-3 text-start">الترتيب</th>
              <th className="px-4 py-3 text-start">المهارة</th>
              <th className="px-4 py-3 text-start">key</th>
              <th className="px-4 py-3 text-start">الفئة</th>
              <th className="px-4 py-3 text-start">الفريق</th>
              <th className="px-4 py-3 text-start">الحالة</th>
              <th className="px-4 py-3 text-start"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {sorted.map((s, i) => (
              <tr key={s.key} className="hover:bg-[var(--surface-hover)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      title="لأعلى"
                      disabled={i === 0}
                      onClick={() => start(() => void reorderSkill(s.key, 'up'))}
                      className="grid h-6 w-6 place-items-center rounded border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      title="لأسفل"
                      disabled={i === sorted.length - 1}
                      onClick={() => start(() => void reorderSkill(s.key, 'down'))}
                      className="grid h-6 w-6 place-items-center rounded border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-[var(--text)]">
                      {s.nameAr}
                    </span>
                    <span className="text-[11px] text-[var(--text-dim)]">{s.nameEn}</span>
                    {s.description && (
                      <span className="mt-0.5 max-w-md truncate text-[11px] text-[var(--text-muted)]">
                        {s.description}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-dim)]">
                  {s.key}
                </td>
                <td className="px-4 py-3">
                  {s.category ? (
                    <StatusPill tone={CAT_TONE[s.category] ?? 'neutral'}>
                      {CAT_LABEL[s.category] ?? s.category}
                    </StatusPill>
                  ) : (
                    <span className="text-[11px] text-[var(--text-dim)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--surface-hover)] px-2 text-[11px] font-medium text-[var(--text-muted)]"
                    title={`${s.usageCount} عضو يحمل هذه المهارة`}
                  >
                    {s.usageCount}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={s.active ? 'success' : 'neutral'} withDot={false}>
                    {s.active ? 'نشطة' : 'معطّلة'}
                  </StatusPill>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      title="تعديل"
                      onClick={() => setEditing(s)}
                      className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      title={s.active ? 'تعطيل' : 'تفعيل'}
                      onClick={() => start(() => void toggleSkillActive(s.key))}
                      className={
                        'grid h-7 w-7 place-items-center rounded-md border ' +
                        (s.active
                          ? 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]')
                      }
                    >
                      <Power size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <SkillDialog mode="edit" skill={editing} onClose={() => setEditing(null)} />
      )}
      {creating && <SkillDialog mode="create" onClose={() => setCreating(false)} />}
    </div>
  );
}

function SkillDialog({
  mode,
  skill,
  onClose,
}: {
  mode: 'create' | 'edit';
  skill?: SkillRow;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const action = mode === 'create' ? createSkill : updateSkill;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">
            {mode === 'create' ? 'مهارة جديدة' : `تعديل: ${skill?.nameAr}`}
          </h2>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          >
            <X size={15} />
          </button>
        </div>

        <form
          action={(fd) => start(async () => { await action(fd); onClose(); })}
          className="space-y-3"
        >
          {mode === 'edit' && <input type="hidden" name="key" value={skill?.key} />}

          {mode === 'create' && (
            <div>
              <label className={labelCls}>المعرّف (key) — إنجليزي، لا يتغيّر لاحقاً</label>
              <input
                name="key"
                required
                placeholder="drone_pilot"
                className={`${field} font-mono`}
                pattern="[A-Za-z0-9 _-]+"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>الاسم (عربي)</label>
              <input
                name="nameAr"
                required
                defaultValue={skill?.nameAr ?? ''}
                placeholder="طيّار درون"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>الاسم (إنجليزي)</label>
              <input
                name="nameEn"
                required
                defaultValue={skill?.nameEn ?? ''}
                placeholder="Drone Pilot"
                className={`${field} text-left`}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>الفئة</label>
              <select
                name="category"
                defaultValue={skill?.category ?? ''}
                className={field}
              >
                <option value="">— بدون —</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>أيقونة (icon key — اختياري)</label>
              <input
                name="iconKey"
                defaultValue={skill?.iconKey ?? ''}
                placeholder="camera"
                className={`${field} font-mono text-left`}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>الوصف (اختياري)</label>
            <textarea
              name="description"
              defaultValue={skill?.description ?? ''}
              rows={2}
              placeholder="وصف مختصر للمهارة ومتى تُسنَد."
              className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={pending}
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {pending ? '…جارٍ الحفظ' : mode === 'create' ? 'إنشاء' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
