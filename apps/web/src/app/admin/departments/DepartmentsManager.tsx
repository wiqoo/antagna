'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Building2 } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import { createDepartment, updateDepartment, deleteDepartment } from './actions';

export interface DeptRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  headProfileId: string | null;
  headName: string | null;
  position: number;
  memberCount: number;
}

export interface PersonOption {
  id: string;
  displayName: string;
}

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';

export function DepartmentsManager({
  departments,
  people,
}: {
  departments: DeptRow[];
  people: PersonOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">{departments.length} قسم</p>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} /> قسم جديد
          </button>
        )}
      </div>

      {creating && (
        <DeptForm
          people={people}
          mode="create"
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {departments.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
          <Building2 size={22} className="mx-auto text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text)]">لا أقسام بعد</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            أنشئ أول قسم لتنظيم الفريق وربط الموظفين به.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {departments.map((d) =>
            editingId === d.id ? (
              <li key={d.id}>
                <DeptForm
                  people={people}
                  mode="edit"
                  dept={d}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--text)]">
                        {d.nameAr}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-dim)]">{d.code}</span>
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {d.nameEn}
                      {d.headName ? ` · رئيس القسم: ${d.headName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone="neutral" withDot={false}>
                    {d.memberCount} عضو
                  </StatusPill>
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => {
                      setEditingId(d.id);
                      setCreating(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <form
                    action={deleteDepartment}
                    onSubmit={(e) => {
                      if (!confirm(`حذف قسم "${d.nameAr}"؟ سيُفصل الأعضاء عنه.`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      title="حذف"
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function DeptForm({
  people,
  mode,
  dept,
  onDone,
  onCancel,
}: {
  people: PersonOption[];
  mode: 'create' | 'edit';
  dept?: DeptRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === 'create' ? createDepartment : updateDepartment;

  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      {mode === 'edit' && dept && <input type="hidden" name="id" value={dept.id} />}

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">
          {mode === 'create' ? 'قسم جديد' : `تعديل ${dept?.nameAr}`}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mode === 'create' && (
          <div>
            <label className={labelCls}>الرمز (code)</label>
            <input
              name="code"
              required
              placeholder="PROD"
              className={inputCls + ' font-mono uppercase'}
              dir="ltr"
            />
          </div>
        )}
        <div>
          <label className={labelCls}>الترتيب</label>
          <input
            type="number"
            name="position"
            defaultValue={dept?.position ?? 0}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>الاسم (عربي)</label>
          <input name="nameAr" required defaultValue={dept?.nameAr ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>الاسم (إنجليزي)</label>
          <input
            name="nameEn"
            required
            defaultValue={dept?.nameEn ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>رئيس القسم</label>
          <select
            name="headProfileId"
            defaultValue={dept?.headProfileId ?? ''}
            className={inputCls}
          >
            <option value="">— بلا رئيس —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="h-9 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          حفظ
        </button>
      </div>
    </form>
  );
}
