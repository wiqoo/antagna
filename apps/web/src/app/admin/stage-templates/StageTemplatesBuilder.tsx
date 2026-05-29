'use client';

import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ListChecks,
  ChevronUp,
  ChevronDown,
  Power,
} from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import {
  createStageTemplate,
  updateStageTemplate,
  toggleStageTemplate,
  deleteStageTemplate,
  reorderStageTemplate,
} from './actions';
import {
  TEMPLATE_STAGES,
  STAGE_LABEL_AR,
  ROLE_LABEL_AR,
  ASSIGNEE_ROLES,
} from './constants';

export interface TemplateRow {
  id: string;
  stage: string;
  titleAr: string;
  titleEn: string | null;
  description: string | null;
  assigneeRoleHint: string | null;
  dueOffsetDays: number | null;
  isMandatory: boolean;
  position: number;
  active: boolean;
}

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';

export function StageTemplatesBuilder({ templates }: { templates: TemplateRow[] }) {
  const [activeStage, setActiveStage] = useState<string>(TEMPLATE_STAGES[0]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const byStage = (stage: string) =>
    templates.filter((t) => t.stage === stage).sort((a, b) => a.position - b.position);

  const list = byStage(activeStage);

  return (
    <div className="space-y-5">
      {/* Stage tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_STAGES.map((s) => {
          const count = templates.filter((t) => t.stage === s).length;
          const isActive = s === activeStage;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setActiveStage(s);
                setCreating(false);
                setEditingId(null);
              }}
              className={
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-colors ' +
                (isActive
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]')
              }
            >
              {STAGE_LABEL_AR[s] ?? s}
              {count > 0 && (
                <span
                  className={
                    'rounded-full px-1.5 text-[10px] ' +
                    (isActive ? 'bg-white/25' : 'bg-[var(--surface-hover)]')
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">
          {list.length} مهمة في مرحلة «{STAGE_LABEL_AR[activeStage]}»
        </p>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} /> مهمة قالب
          </button>
        )}
      </div>

      {creating && (
        <TemplateForm
          stage={activeStage}
          mode="create"
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {list.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
          <ListChecks size={22} className="mx-auto text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text)]">
            لا مهام قالب لهذه المرحلة
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            أضف المهام التي تُنشأ تلقائياً عند دخول المشروع مرحلة «{STAGE_LABEL_AR[activeStage]}».
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((t, i) =>
            editingId === t.id ? (
              <li key={t.id}>
                <TemplateForm
                  stage={activeStage}
                  mode="edit"
                  tpl={t}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={t.id}
                className={
                  'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ' +
                  (t.active
                    ? 'border-[var(--line)] bg-[var(--surface)]'
                    : 'border-dashed border-[var(--line)] bg-[var(--surface)] opacity-60')
                }
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--surface-hover)] font-mono text-[11px] text-[var(--text-muted)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--text)]">
                        {t.titleAr}
                      </span>
                      {t.isMandatory && (
                        <StatusPill tone="warning" withDot={false}>
                          إلزامي
                        </StatusPill>
                      )}
                      {t.assigneeRoleHint && (
                        <StatusPill tone="neutral" withDot={false}>
                          {ROLE_LABEL_AR[t.assigneeRoleHint] ?? t.assigneeRoleHint}
                        </StatusPill>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {t.titleEn ? `${t.titleEn} · ` : ''}
                      {t.dueOffsetDays != null
                        ? `استحقاق +${t.dueOffsetDays} يوم`
                        : 'بلا استحقاق'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <form action={reorderStageTemplate} className="contents">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button
                      type="submit"
                      disabled={i === 0}
                      title="أعلى"
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                  </form>
                  <form action={reorderStageTemplate} className="contents">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button
                      type="submit"
                      disabled={i === list.length - 1}
                      title="أسفل"
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </form>
                  <form action={toggleStageTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      title={t.active ? 'تعطيل' : 'تفعيل'}
                      className={
                        'grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] ' +
                        (t.active
                          ? 'text-[var(--accent)] hover:border-[var(--accent)]'
                          : 'text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]')
                      }
                    >
                      <Power size={13} />
                    </button>
                  </form>
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => {
                      setEditingId(t.id);
                      setCreating(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <form
                    action={deleteStageTemplate}
                    onSubmit={(e) => {
                      if (!confirm(`حذف مهمة القالب "${t.titleAr}"؟`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={t.id} />
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

function TemplateForm({
  stage,
  mode,
  tpl,
  onDone,
  onCancel,
}: {
  stage: string;
  mode: 'create' | 'edit';
  tpl?: TemplateRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === 'create' ? createStageTemplate : updateStageTemplate;
  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      {mode === 'edit' && tpl && <input type="hidden" name="id" value={tpl.id} />}
      <input type="hidden" name="stage" value={stage} />

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">
          {mode === 'create'
            ? `مهمة جديدة في «${STAGE_LABEL_AR[stage]}»`
            : `تعديل ${tpl?.titleAr}`}
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
        <div>
          <label className={labelCls}>العنوان (عربي)</label>
          <input name="titleAr" required defaultValue={tpl?.titleAr ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>العنوان (إنجليزي)</label>
          <input name="titleEn" defaultValue={tpl?.titleEn ?? ''} className={inputCls} dir="ltr" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>الوصف</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={tpl?.description ?? ''}
            className={inputCls.replace('h-9', 'min-h-[60px] py-2')}
          />
        </div>
        <div>
          <label className={labelCls}>الدور المقترح للمكلّف</label>
          <select
            name="assigneeRoleHint"
            defaultValue={tpl?.assigneeRoleHint ?? ''}
            className={inputCls}
          >
            <option value="">— بلا دور محدّد —</option>
            {ASSIGNEE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL_AR[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>الاستحقاق (أيام من بدء المرحلة)</label>
          <input
            name="dueOffsetDays"
            type="number"
            placeholder="مثال: 3"
            defaultValue={tpl?.dueOffsetDays ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] sm:col-span-2">
          <input
            type="checkbox"
            name="isMandatory"
            defaultChecked={tpl?.isMandatory ?? false}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          مهمة إلزامية (تمنع الانتقال للمرحلة التالية حتى تُغلق)
        </label>
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
