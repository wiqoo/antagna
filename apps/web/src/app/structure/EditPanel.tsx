'use client';

import { DEPTS, DEPT_KEYS, type Dept, type OrgNode } from './org-data';

const field =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';

interface Props {
  node: OrgNode;
  isRoot: boolean;
  childCount: number;
  onChange: (patch: Partial<OrgNode>) => void;
  onAddChild: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EditPanel({ node, isRoot, childCount, onChange, onAddChild, onDelete, onClose }: Props) {
  return (
    <div
      className="absolute top-0 z-40 flex h-full w-[320px] max-w-[88vw] flex-col gap-4 border-s border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl"
      style={{ insetInlineEnd: 0 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">تعديل البطاقة</h3>
        <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text)]">
          ✕
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[var(--text-muted)]">الاسم</span>
        <input
          className={field}
          value={node.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[var(--text-muted)]">الدور / المسمّى</span>
        <input
          className={field}
          value={node.role}
          onChange={(e) => onChange({ role: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[var(--text-muted)]">القسم</span>
        <select
          className={field}
          value={node.dept}
          onChange={(e) => onChange({ dept: e.target.value as Dept })}
        >
          {DEPT_KEYS.map((k) => (
            <option key={k} value={k}>
              {DEPTS[k].label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2.5">
        <span className="text-[12px] text-[var(--text-muted)]">شاغر</span>
        <button
          role="switch"
          aria-checked={node.vacant}
          onClick={() => onChange({ vacant: !node.vacant })}
          className="relative h-6 w-11 rounded-full transition-colors"
          style={{ background: node.vacant ? 'var(--accent)' : 'var(--line-bold)' }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ insetInlineStart: node.vacant ? 22 : 2 }}
          />
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={onAddChild}
          className="rounded-lg bg-[var(--accent)] px-3 py-2.5 text-[13px] font-medium text-[#1a1a1a] transition-colors hover:bg-[var(--accent-hover)]"
        >
          + إضافة تابع
        </button>
        <button
          onClick={onDelete}
          disabled={isRoot}
          className="rounded-lg border border-[var(--danger)]/40 px-3 py-2.5 text-[13px] font-medium text-[var(--danger)] transition-colors enabled:hover:bg-[var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRoot
            ? 'لا يمكن حذف الجذر'
            : childCount > 0
              ? `حذف (يُنقل ${childCount} تابع للأعلى)`
              : 'حذف'}
        </button>
      </div>
    </div>
  );
}
