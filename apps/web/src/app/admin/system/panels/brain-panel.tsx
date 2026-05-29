'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, CardHeader, StatBox, StatusPill, EmptyState } from '@antagna/ui';
import { BrainCircuit, Database, Trash2, Sparkles, ChevronLeft } from 'lucide-react';
import { ChunkActions } from './chunk-actions';
import { BrainMaintenance } from './brain-maintenance';

interface Chunk {
  id: string;
  scope: string;
  scopeId: string | null;
  source: string;
  preview: string;
  retrievalCount: number;
  lastRetrievedAt: string | null;
  useful: boolean | null;
  relevanceScore: number | null;
  createdAt: string;
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().slice(0, 10);
}

export function BrainPanel({
  chunks,
  scopes,
  sources,
  counts,
  canManage,
}: {
  chunks: Chunk[];
  scopes: string[];
  sources: string[];
  counts: { total: number; prunable: number };
  canManage: boolean;
}) {
  const [scope, setScope] = useState('');
  const [source, setSource] = useState('');

  const filtered = useMemo(
    () =>
      chunks.filter(
        (c) => (!scope || c.scope === scope) && (!source || c.source === source),
      ),
    [chunks, scope, source],
  );

  const selectCls =
    'h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--text)]';

  return (
    <div className="space-y-4">
      <Link
        href="/admin/ai-insights"
        className="group flex items-center gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.03] p-4 transition-colors hover:border-[var(--accent)]/60"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-hover)] text-[var(--accent)]">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text)]">رؤى الذكاء الاصطناعي · حلقة التعلّم</p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            معدّل قبول الاقتراحات، الثقة المُكتسبة، نتائج القرارات، والانتقالات المحجوبة
          </p>
        </div>
        <ChevronLeft
          size={16}
          className="shrink-0 text-[var(--text-dim)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]"
        />
      </Link>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox label="إجمالي الذاكرة" value={counts.total} icon={<Database size={16} />} sub="ai_memory_chunks" />
        <StatBox label="معروضة (آخر 100)" value={chunks.length} icon={<BrainCircuit size={16} />} />
        <StatBox
          label="قابلة للتقليم"
          value={counts.prunable}
          icon={<Trash2 size={16} />}
          tone={counts.prunable > 0 ? 'warning' : 'default'}
          sub="0 استرجاع · أقدم من 30 يومًا"
        />
      </section>

      <BrainMaintenance prunable={counts.prunable} canManage={canManage} />

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
          <CardHeader title="متصفّح الذاكرة" subtitle={`${filtered.length} مقطع`} />
          <div className="flex flex-wrap items-center gap-2">
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={selectCls}>
              <option value="">كل النطاقات</option>
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
              <option value="">كل المصادر</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<BrainCircuit size={20} />}
            title="لا مقاطع ذاكرة"
            description="بتتعبّى تلقائيًا من الملخّصات والمحادثات والمعرفة المُفهرسة."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">النطاق</th>
                  <th className="px-5 py-3 text-start">المصدر</th>
                  <th className="px-5 py-3 text-start">المحتوى</th>
                  <th className="px-5 py-3 text-start">استرجاع</th>
                  <th className="px-5 py-3 text-start">الصلة</th>
                  <th className="px-5 py-3 text-start">أُنشئ</th>
                  <th className="px-5 py-3 text-end"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3">
                      <StatusPill tone="info" withDot={false}>
                        {c.scope}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-muted)]">{c.source}</td>
                    <td className="px-5 py-3">
                      <p className="max-w-[28rem] truncate text-xs text-[var(--text)]" title={c.preview}>
                        {c.preview}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">
                      {c.retrievalCount}
                      {c.lastRetrievedAt && (
                        <span className="ms-1 text-[10px]">({fmt(c.lastRetrievedAt)})</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">
                      {c.relevanceScore != null ? c.relevanceScore.toFixed(2) : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{fmt(c.createdAt)}</td>
                    <td className="px-5 py-3 text-end">
                      <ChunkActions id={c.id} useful={c.useful} canManage={canManage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!canManage && (
        <StatusPill tone="neutral">عرض فقط — تحتاج صلاحية memory.manage للتعديل</StatusPill>
      )}
    </div>
  );
}
