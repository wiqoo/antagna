'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Boxes,
  Plus,
  X,
  Package,
  Star,
  Sparkles,
  Check,
  Trash2,
  Anchor,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { StatusPill, EmptyState } from '@antagna/ui';
import {
  createSetup,
  addSetupItem,
  removeSetupItem,
  toggleSetupItemMandatory,
  setSetupItemQuantity,
  renameSetup,
  deleteSetup,
  setSetupPrimary,
} from '../actions';

// ── shared types (mirrored by the server page) ──────────────────────────────

export interface EqOption {
  id: string;
  code: string;
  model: string | null;
  manufacturer: string | null;
  category: string;
  groupId: string | null;
  status: string;
}

export interface GroupOption {
  id: string;
  code: string;
  nameAr: string;
  category: string | null;
}

export interface SetupItemRow {
  id: string;
  kitId: string;
  equipmentId: string | null;
  equipmentGroupId: string | null;
  quantity: number;
  isMandatory: boolean;
  position: number;
  notes: string | null;
  eqCode: string | null;
  eqModel: string | null;
  eqManufacturer: string | null;
  eqCategory: string | null;
  groupNameAr: string | null;
  groupCategory: string | null;
}

export interface SetupRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  active: boolean;
  primaryEquipmentId: string | null;
  primaryCode: string | null;
  primaryModel: string | null;
  primaryManufacturer: string | null;
  primaryCategory: string | null;
  primaryGroupId: string | null;
}

export type SetupWithItems = SetupRow & { items: SetupItemRow[] };

export interface CompatPair {
  itemAId: string | null;
  itemBId: string | null;
  groupAId: string | null;
  groupBId: string | null;
  verdict: string;
  reasonAr: string | null;
  verifiedCount: number;
}

export interface SuggestionRow {
  id: string;
  primaryGroupId: string;
  suggestedItemGroupId: string | null;
  suggestedItemId: string | null;
  quantity: number;
  importance: string;
  reasonAr: string | null;
  suggestedGroupNameAr: string | null;
  suggestedItemCode: string | null;
  suggestedItemModel: string | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function eqLabel(e: EqOption): string {
  return [e.manufacturer, e.model].filter(Boolean).join(' ') || e.code;
}

function itemLabel(it: SetupItemRow): string {
  if (it.equipmentId) {
    return [it.eqManufacturer, it.eqModel].filter(Boolean).join(' ') || it.eqCode || '—';
  }
  if (it.equipmentGroupId) return it.groupNameAr ?? 'مجموعة';
  return '—';
}

const IMPORTANCE_TONE: Record<string, 'warning' | 'info' | 'neutral'> = {
  mandatory: 'warning',
  recommended: 'info',
  optional: 'neutral',
};
const IMPORTANCE_AR: Record<string, string> = {
  mandatory: 'إلزامي',
  recommended: 'مُوصى',
  optional: 'اختياري',
};

// ── component ──────────────────────────────────────────────────────────────

export function KitBuilder({
  setups,
  eqOptions,
  groupOptions,
  compat,
  suggestions,
  canEdit,
}: {
  setups: SetupWithItems[];
  eqOptions: EqOption[];
  groupOptions: GroupOption[];
  compat: CompatPair[];
  suggestions: SuggestionRow[];
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(setups[0]?.id ?? null);

  // create-setup form state
  const [newName, setNewName] = useState('');
  const [newPrimary, setNewPrimary] = useState('');

  const eqById = useMemo(() => {
    const m = new Map<string, EqOption>();
    for (const e of eqOptions) m.set(e.id, e);
    return m;
  }, [eqOptions]);

  const active = setups.find((s) => s.id === activeId) ?? null;

  // ── compatibility lookup: for a given primary item, which item/group ids
  //    are verified-compatible (and which are incompatible)? ──────────────────
  const companionInfo = useMemo(() => {
    if (!active?.primaryEquipmentId) {
      return { compatItemIds: new Set<string>(), incompatItemIds: new Set<string>(), compatGroupIds: new Set<string>() };
    }
    const primaryId = active.primaryEquipmentId;
    const primaryGroupId = active.primaryGroupId;
    const compatItemIds = new Set<string>();
    const incompatItemIds = new Set<string>();
    const compatGroupIds = new Set<string>();
    for (const r of compat) {
      const isCompat = r.verdict === 'compatible';
      // item↔item rules
      if (r.itemAId === primaryId && r.itemBId) {
        (isCompat ? compatItemIds : incompatItemIds).add(r.itemBId);
      } else if (r.itemBId === primaryId && r.itemAId) {
        (isCompat ? compatItemIds : incompatItemIds).add(r.itemAId);
      }
      // group↔group rules → resolve to "any item in the other group"
      if (primaryGroupId && r.groupAId === primaryGroupId && r.groupBId && isCompat) {
        compatGroupIds.add(r.groupBId);
      } else if (primaryGroupId && r.groupBId === primaryGroupId && r.groupAId && isCompat) {
        compatGroupIds.add(r.groupAId);
      }
    }
    return { compatItemIds, incompatItemIds, compatGroupIds };
  }, [active, compat]);

  // Suggestions that apply to the active setup's primary group.
  const activeSuggestions = useMemo(() => {
    if (!active?.primaryGroupId) return [];
    return suggestions.filter((s) => s.primaryGroupId === active.primaryGroupId);
  }, [active, suggestions]);

  // Items already in the active setup (avoid duplicate suggestions).
  const usedItemIds = useMemo(
    () => new Set((active?.items ?? []).map((i) => i.equipmentId).filter(Boolean) as string[]),
    [active],
  );
  const usedGroupIds = useMemo(
    () => new Set((active?.items ?? []).map((i) => i.equipmentGroupId).filter(Boolean) as string[]),
    [active],
  );

  // Equipment options sorted so verified companions float to the top.
  const sortedAddOptions = useMemo(() => {
    const { compatItemIds, compatGroupIds, incompatItemIds } = companionInfo;
    return [...eqOptions]
      .filter((e) => e.id !== active?.primaryEquipmentId && !usedItemIds.has(e.id))
      .map((e) => {
        const directCompat = compatItemIds.has(e.id);
        const groupCompat = e.groupId ? compatGroupIds.has(e.groupId) : false;
        const incompat = incompatItemIds.has(e.id);
        return { e, score: directCompat ? 2 : groupCompat ? 1 : 0, incompat };
      })
      .sort((a, b) => b.score - a.score || a.e.code.localeCompare(b.e.code));
  }, [eqOptions, companionInfo, active, usedItemIds]);

  // ── action wrappers ─────────────────────────────────────────────────────
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? 'تعذّر تنفيذ العملية');
    });
  }

  function handleCreate() {
    if (!newName.trim()) {
      setErr('اكتب اسم السِتب أولاً');
      return;
    }
    setErr(null);
    const fd = new FormData();
    fd.set('nameAr', newName.trim());
    if (newPrimary) fd.set('primaryEquipmentId', newPrimary);
    start(async () => {
      const r = await createSetup(fd);
      if (!r.ok) {
        setErr(r.error ?? 'تعذّر الإنشاء');
        return;
      }
      setNewName('');
      setNewPrimary('');
      if (r.kitId) setActiveId(r.kitId);
    });
  }

  // ── add-companion control state (per active setup) ────────────────────────
  const [addEqId, setAddEqId] = useState('');
  const [addGroupId, setAddGroupId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addMandatory, setAddMandatory] = useState(false);

  function handleAddItem() {
    if (!active) return;
    if (!addEqId && !addGroupId) {
      setErr('اختر عنصراً أو مجموعة لإضافتها');
      return;
    }
    run(async () => {
      const r = await addSetupItem(active.id, {
        equipmentId: addEqId || null,
        equipmentGroupId: addEqId ? null : addGroupId || null,
        quantity: addQty,
        mandatory: addMandatory,
      });
      if (r.ok) {
        setAddEqId('');
        setAddGroupId('');
        setAddQty(1);
        setAddMandatory(false);
      }
      return r;
    });
  }

  function handleAddSuggestion(s: SuggestionRow) {
    if (!active) return;
    run(() =>
      addSetupItem(active.id, {
        equipmentId: s.suggestedItemId || null,
        equipmentGroupId: s.suggestedItemId ? null : s.suggestedItemGroupId || null,
        quantity: s.quantity,
        mandatory: s.importance === 'mandatory',
        notes: s.reasonAr,
      }),
    );
  }

  const readOnlyBanner = !canEdit && (
    <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[12px] text-[var(--text-muted)]">
      <AlertTriangle size={14} className="text-[var(--warning)]" />
      عرض فقط — تحتاج صلاحية تعديل المعدات (equipment.update) لبناء السِتب.
    </div>
  );

  return (
    <div className="space-y-5">
      {readOnlyBanner}
      {err && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-2.5 text-[12px] text-[var(--danger)]">
          <span>{err}</span>
          <button onClick={() => setErr(null)} aria-label="إغلاق">
            <X size={14} />
          </button>
        </div>
      )}

      {/* New setup creator */}
      {canEdit && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            <Plus size={13} /> سِتب جديد
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم السِتب (مثلاً: ريل سوشيال · ستوديو منتج)"
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
            <select
              value={newPrimary}
              onChange={(e) => setNewPrimary(e.target.value)}
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">— العنصر الأساسي (اختياري) —</option>
              {eqOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {eqLabel(o)}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={pending}
              className="magnet inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Plus size={15} /> ابدأ السِتب
            </button>
          </div>
        </div>
      )}

      {setups.length === 0 ? (
        <EmptyState
          icon={<Boxes size={20} />}
          title="لا توجد سِتب بعد"
          description="ابدأ سِتب — مثل «ريل سوشيال» — اختر الكاميرا الأساسية، ثم أضِف العدسات والإضاءة المتوافقة."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          {/* Setup picker rail */}
          <div className="space-y-1.5">
            <p className="section-rule" style={{ minWidth: 80 }}>
              السِتب
            </p>
            <div className="mt-2 space-y-1">
              {setups.map((s) => {
                const isActive = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={
                      'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-start transition-colors ' +
                      (isActive
                        ? 'border-[var(--accent)] bg-[var(--accent-tint)]'
                        : 'border-[var(--line)] bg-[var(--bg-elevated)]/40 hover:border-[var(--line-strong)]')
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[var(--text)]">
                        {s.nameAr}
                      </span>
                      <span className="block font-mono text-[10px] text-[var(--text-dim)]">
                        {s.code} · {s.items.length} عنصر
                      </span>
                    </span>
                    <StatusPill tone={s.active ? 'success' : 'neutral'} withDot={false}>
                      {s.active ? 'نشط' : 'متوقّف'}
                    </StatusPill>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active setup editor */}
          {active ? (
            <SetupEditor
              key={active.id}
              setup={active}
              eqById={eqById}
              groupOptions={groupOptions}
              sortedAddOptions={sortedAddOptions}
              companionInfo={companionInfo}
              activeSuggestions={activeSuggestions}
              usedGroupIds={usedGroupIds}
              canEdit={canEdit}
              pending={pending}
              run={run}
              addEqId={addEqId}
              setAddEqId={setAddEqId}
              addGroupId={addGroupId}
              setAddGroupId={setAddGroupId}
              addQty={addQty}
              setAddQty={setAddQty}
              addMandatory={addMandatory}
              setAddMandatory={setAddMandatory}
              onAddItem={handleAddItem}
              onAddSuggestion={handleAddSuggestion}
            />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--line)] p-10 text-[13px] text-[var(--text-dim)]">
              اختر سِتب من القائمة لتحريره.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── per-setup editor ──────────────────────────────────────────────────────

function SetupEditor({
  setup,
  eqById,
  groupOptions,
  sortedAddOptions,
  companionInfo,
  activeSuggestions,
  usedGroupIds,
  canEdit,
  pending,
  run,
  addEqId,
  setAddEqId,
  addGroupId,
  setAddGroupId,
  addQty,
  setAddQty,
  addMandatory,
  setAddMandatory,
  onAddItem,
  onAddSuggestion,
}: {
  setup: SetupWithItems;
  eqById: Map<string, EqOption>;
  groupOptions: GroupOption[];
  sortedAddOptions: { e: EqOption; score: number; incompat: boolean }[];
  companionInfo: { compatItemIds: Set<string>; incompatItemIds: Set<string>; compatGroupIds: Set<string> };
  activeSuggestions: SuggestionRow[];
  usedGroupIds: Set<string>;
  canEdit: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  addEqId: string;
  setAddEqId: (v: string) => void;
  addGroupId: string;
  setAddGroupId: (v: string) => void;
  addQty: number;
  setAddQty: (v: number) => void;
  addMandatory: boolean;
  setAddMandatory: (v: boolean) => void;
  onAddItem: () => void;
  onAddSuggestion: (s: SuggestionRow) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(setup.nameAr);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mandatoryCount = setup.items.filter((i) => i.isMandatory).length;
  const compatCount = companionInfo.compatItemIds.size;

  return (
    <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-5">
      {/* header — name + primary anchor */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div className="min-w-0">
          {editingName && canEdit ? (
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-9 w-64 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                onClick={() =>
                  run(async () => {
                    const r = await renameSetup(setup.id, { nameAr: nameDraft });
                    if (r.ok) setEditingName(false);
                    return r;
                  })
                }
                disabled={pending}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-[var(--accent)] px-3 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                <Check size={13} /> حفظ
              </button>
              <button
                onClick={() => {
                  setNameDraft(setup.nameAr);
                  setEditingName(false);
                }}
                className="text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <>
              <p className="font-mono text-[10px] text-[var(--text-dim)]">{setup.code}</p>
              <h3 className="flex items-center gap-2 text-[18px] font-semibold text-[var(--text)]">
                {setup.nameAr}
                {canEdit && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-[10px] font-normal text-[var(--text-dim)] hover:text-[var(--accent)]"
                  >
                    تعديل الاسم
                  </button>
                )}
              </h3>
            </>
          )}

          {/* primary anchor */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {setup.primaryCode ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-tint)] px-2.5 py-1 text-[11px] text-[var(--text)]">
                <Anchor size={11} className="text-[var(--accent)]" />
                <span className="font-mono text-[10px] text-[var(--text-dim)]">{setup.primaryCode}</span>
                {[setup.primaryManufacturer, setup.primaryModel].filter(Boolean).join(' ')}
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                  أساسي
                </span>
              </span>
            ) : (
              canEdit && <PrimaryPicker setup={setup} eqById={eqById} run={run} pending={pending} />
            )}
            {compatCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
                <Sparkles size={11} className="text-[var(--accent)]" />
                {compatCount} مرفق متوافق معروف
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() =>
                run(() => renameSetup(setup.id, { nameAr: setup.nameAr, active: !setup.active }))
              }
              disabled={pending}
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] disabled:opacity-50"
            >
              {setup.active ? 'إيقاف' : 'تفعيل'}
            </button>
            {confirmDelete ? (
              <button
                onClick={() => run(() => deleteSetup(setup.id))}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-3 py-1.5 text-[11px] font-semibold text-[var(--danger)] disabled:opacity-50"
              >
                <Trash2 size={12} /> تأكيد الحذف
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-[var(--text-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                aria-label="حذف السِتب"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI / learned suggestions for this primary */}
      {canEdit && activeSuggestions.length > 0 && (
        <div className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)]/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
            <Sparkles size={12} className="text-[var(--accent)]" /> اقتراحات للسِتب
          </div>
          <div className="flex flex-wrap gap-2">
            {activeSuggestions
              .filter(
                (s) =>
                  !(s.suggestedItemGroupId && usedGroupIds.has(s.suggestedItemGroupId)),
              )
              .map((s) => {
                const label =
                  s.suggestedItemModel ??
                  s.suggestedGroupNameAr ??
                  s.suggestedItemCode ??
                  'عنصر';
                return (
                  <button
                    key={s.id}
                    onClick={() => onAddSuggestion(s)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50"
                    title={s.reasonAr ?? undefined}
                  >
                    <Plus size={11} className="text-[var(--accent)]" />
                    ×{s.quantity} {label}
                    <StatusPill tone={IMPORTANCE_TONE[s.importance] ?? 'neutral'} withDot={false}>
                      {IMPORTANCE_AR[s.importance] ?? s.importance}
                    </StatusPill>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* item list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[var(--text)]">
            عناصر السِتب
            <span className="ms-2 text-[10px] font-normal text-[var(--text-dim)]">
              {setup.items.length} عنصر · {mandatoryCount} إلزامي
            </span>
          </p>
        </div>

        {setup.items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--line)] px-4 py-6 text-center text-[12px] text-[var(--text-dim)]">
            لا عناصر بعد. أضِف عنصراً متوافقاً من الأسفل.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-md border border-[var(--line)]">
            {setup.items.map((it) => {
              const isCompat = it.equipmentId
                ? companionInfo.compatItemIds.has(it.equipmentId)
                : false;
              return (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {it.equipmentGroupId ? (
                      <Layers size={13} className="shrink-0 text-[var(--text-dim)]" />
                    ) : (
                      <Package size={13} className="shrink-0 text-[var(--text-dim)]" />
                    )}
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      ×{it.quantity}
                    </span>
                    <span className="truncate text-[var(--text)]">
                      {it.eqCode && (
                        <span className="me-1 font-mono text-[10px] text-[var(--text-dim)]">
                          {it.eqCode}
                        </span>
                      )}
                      {itemLabel(it)}
                      {it.equipmentGroupId && (
                        <span className="ms-1 text-[10px] text-[var(--text-dim)]">(أي وحدة)</span>
                      )}
                    </span>
                    {isCompat && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--accent)]">
                        <Sparkles size={9} /> متوافق
                      </span>
                    )}
                    {it.isMandatory && (
                      <StatusPill tone="warning" withDot={false}>
                        إلزامي
                      </StatusPill>
                    )}
                  </span>

                  {canEdit && (
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() =>
                          run(() => toggleSetupItemMandatory(it.id, !it.isMandatory))
                        }
                        disabled={pending}
                        className={
                          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] disabled:opacity-50 ' +
                          (it.isMandatory
                            ? 'border-[var(--warning)]/50 text-[var(--warning)]'
                            : 'border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)]')
                        }
                        title={it.isMandatory ? 'اجعله اختيارياً' : 'علّمه إلزامياً'}
                      >
                        <Star size={11} className={it.isMandatory ? 'fill-current' : ''} />
                        {it.isMandatory ? 'إلزامي' : 'اختياري'}
                      </button>
                      <input
                        type="number"
                        min={1}
                        defaultValue={it.quantity}
                        onBlur={(e) => {
                          const q = Number(e.target.value);
                          if (q > 0 && q !== it.quantity) {
                            run(() => setSetupItemQuantity(it.id, q));
                          }
                        }}
                        className="h-7 w-12 rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 text-center font-mono text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <button
                        onClick={() => run(() => removeSetupItem(it.id))}
                        disabled={pending}
                        className="text-[var(--text-dim)] hover:text-[var(--danger)] disabled:opacity-50"
                        aria-label="حذف العنصر"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* add a companion */}
      {canEdit && (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
            <Plus size={12} /> أضِف مرفقاً متوافقاً
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <select
              value={addEqId}
              onChange={(e) => {
                setAddEqId(e.target.value);
                if (e.target.value) setAddGroupId('');
              }}
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">— عنصر محدّد —</option>
              {sortedAddOptions.map(({ e, score, incompat }) => (
                <option key={e.id} value={e.id}>
                  {score > 0 ? '★ ' : incompat ? '⚠ ' : ''}
                  {e.code} · {eqLabel(e)}
                  {incompat ? ' (غير متوافق)' : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={addQty}
              onChange={(e) => setAddQty(Number(e.target.value) || 1)}
              className="h-9 w-16 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-center font-mono text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={addMandatory}
                onChange={(e) => setAddMandatory(e.target.checked)}
              />
              إلزامي
            </label>
            <button
              onClick={onAddItem}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Plus size={14} /> أضف
            </button>
          </div>
          {/* group line (any-unit) */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-dim)]">أو أضِف مجموعة:</span>
            <select
              value={addGroupId}
              onChange={(e) => {
                setAddGroupId(e.target.value);
                if (e.target.value) setAddEqId('');
              }}
              className="h-8 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">— أي وحدة من مجموعة —</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {companionInfo.compatGroupIds.has(g.id) ? '★ ' : ''}
                  {g.nameAr}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[10px] text-[var(--text-dim)]">
            ★ = متوافق مؤكَّد مع العنصر الأساسي · ⚠ = سُجِّل عدم توافق سابقاً
          </p>
        </div>
      )}
    </div>
  );
}

// ── set primary anchor when the setup has none ───────────────────────────────

function PrimaryPicker({
  setup,
  eqById,
  run,
  pending,
}: {
  setup: SetupWithItems;
  eqById: Map<string, EqOption>;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
}) {
  const [val, setVal] = useState('');
  const options = useMemo(() => Array.from(eqById.values()), [eqById]);
  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
      >
        <option value="">— اختر العنصر الأساسي —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.code} · {[o.manufacturer, o.model].filter(Boolean).join(' ') || o.code}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!val) return;
          run(() => setSetupPrimary(setup.id, val));
        }}
        disabled={pending || !val}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--accent)]/50 bg-[var(--accent-tint)] px-2.5 text-[11px] text-[var(--text)] disabled:opacity-50"
      >
        <Anchor size={11} /> ثبّت أساسي
      </button>
    </span>
  );
}
