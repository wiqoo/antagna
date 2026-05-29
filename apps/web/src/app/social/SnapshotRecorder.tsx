'use client';

import { useState } from 'react';
import { Plus, X, BarChart3 } from 'lucide-react';
import { Card, EmptyState } from '@antagna/ui';
import { recordSnapshot } from './actions';

export interface SnapshotPostOption {
  id: string;
  title: string;
  accountHandle: string;
}

/** Manual analytics-snapshot entry (tracking only — no API pull, D-028). */
export function SnapshotRecorder({ posts }: { posts: SnapshotPostOption[] }) {
  const [open, setOpen] = useState(false);

  if (posts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BarChart3 size={18} />}
          title="لا توجد منشورات لتسجيل تحليلاتها"
          description="أضف منشوراً من تبويب «التقويم والمحتوى» أولاً، ثم سجّل لقطات الأداء هنا."
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text)]">تسجيل لقطة أداء</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text)] hover:border-[var(--line-strong)]"
        >
          {open ? <X size={13} /> : <Plus size={13} />}
          {open ? 'إغلاق' : 'لقطة جديدة'}
        </button>
      </div>

      {open && (
        <form action={recordSnapshot} onSubmit={() => setOpen(false)} className="mt-4 space-y-2">
          <select name="postId" required className="sc-in w-full">
            <option value="">— المنشور —</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                @{p.accountHandle} · {p.title}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input name="views" type="number" min="0" placeholder="مشاهدات" dir="ltr" className="sc-in" />
            <input name="reachUnique" type="number" min="0" placeholder="وصول (reach)" dir="ltr" className="sc-in" />
            <input name="likes" type="number" min="0" placeholder="إعجابات" dir="ltr" className="sc-in" />
            <input name="comments" type="number" min="0" placeholder="تعليقات" dir="ltr" className="sc-in" />
            <input name="shares" type="number" min="0" placeholder="مشاركات" dir="ltr" className="sc-in" />
            <input name="saves" type="number" min="0" placeholder="حفظ" dir="ltr" className="sc-in" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-[var(--text-dim)]">
              معدل التفاعل يُحسب تلقائياً من (إعجابات+تعليقات+مشاركات+حفظ) ÷ الوصول.
            </p>
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-black hover:opacity-90"
            >
              <Plus size={14} /> سجّل
            </button>
          </div>
          <style>{`.sc-in{height:36px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elevated);color:var(--text);font-size:13px;padding:0 10px;}.sc-in:focus{outline:none;border-color:var(--accent);}`}</style>
        </form>
      )}
    </Card>
  );
}
