'use client';

import { useState } from 'react';
import { Sliders, X, RotateCcw } from 'lucide-react';
import {
  saveDashboardCustomization,
  resetDashboardCustomization,
} from './dashboard-customize-actions';

export const CARD_CATALOG = [
  { id: 'projects-at-risk', label: 'مشاريع في خطر', group: 'إنتاج' },
  { id: 'approval-queue',   label: 'قائمة الموافقات', group: 'إنتاج' },
  { id: 'equipment-conflicts', label: 'تعارضات معدات', group: 'إنتاج' },
  { id: 'team-load',        label: 'حمولة الفريق · ١٤ يوم', group: 'الفريق' },
  { id: 'mtd-revenue',      label: 'إيراد الشهر', group: 'مالية' },

  { id: 'email-health',      label: 'صحة الوارد (مَن ينتظر؟)', group: 'الإيميل' },
  { id: 'email-suggestions', label: 'اقتراحات AI من الإيميل',  group: 'الإيميل' },
  { id: 'email-recent',      label: 'آخر إيميلات بملخص AI',    group: 'الإيميل' },
  { id: 'email-followups',   label: 'متابعات مستحقة',          group: 'الإيميل' },

  { id: 'mini-active',  label: 'مشاريع نشطة (مصغّر)', group: 'إحصائيات' },
  { id: 'mini-tasks',   label: 'مهام مفتوحة (مصغّر)', group: 'إحصائيات' },
  { id: 'mini-leads',   label: 'Leads (مصغّر)',       group: 'إحصائيات' },
  { id: 'mini-review',  label: 'بانتظار مراجعة (مصغّر)', group: 'إحصائيات' },
] as const;

export type CardId = (typeof CARD_CATALOG)[number]['id'];

export function CustomizeButton({ hidden }: { hidden: string[] }) {
  const [open, setOpen] = useState(false);
  const total = CARD_CATALOG.length;
  const visibleCount = total - hidden.length;

  // Group rendering
  const groups = Array.from(new Set(CARD_CATALOG.map((c) => c.group)));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ms-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]"
        title="تخصيص الكروت"
      >
        <Sliders size={11} />
        تخصيص · {visibleCount}/{total}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="fixed end-0 top-0 flex h-full w-full max-w-sm flex-col border-s border-[var(--line-strong)] bg-[var(--surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="تخصيص الداش بورد"
          >
            <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  — تخصيص اللوحة
                </p>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">
                  اختر الكروت اللي تظهرلك
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--text)]"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
            </header>

            <form
              action={async (fd) => {
                await saveDashboardCustomization(fd);
                setOpen(false);
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <input
                type="hidden"
                name="all"
                value={CARD_CATALOG.map((c) => c.id).join(',')}
              />

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
                {groups.map((group) => (
                  <fieldset key={group} className="space-y-2">
                    <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                      {group}
                    </legend>
                    <div className="space-y-1.5">
                      {CARD_CATALOG.filter((c) => c.group === group).map((c) => {
                        const isVisible = !hidden.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 hover:border-[var(--line-strong)]"
                          >
                            <input
                              type="checkbox"
                              name="visible"
                              value={c.id}
                              defaultChecked={isVisible}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                            <span className="flex-1 text-[12px] text-[var(--text)]">
                              {c.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await resetDashboardCustomization();
                      setOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                  >
                    <RotateCcw size={11} />
                    إعادة للوضع الافتراضي (إظهار الكل)
                  </button>
                </div>
              </div>

              <footer className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--bg)]/40 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-md px-4 text-[12px] font-semibold text-white"
                  style={{ background: 'var(--accent-gradient)' }}
                >
                  حفظ
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
