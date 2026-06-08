'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, X, Loader2, Archive, History, Clock } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import {
  PROJECT_STAGE_ORDER,
  PROJECT_STAGE_LABELS_AR,
  stageLabelAr,
  stageTone,
} from '@/lib/project-stage';
import { transitionStage } from './actions';

export type StageHistoryItem = {
  fromLabel: string | null;
  toLabel: string;
  byName: string | null;
  whenLabel: string;
  reason: string | null;
};

const NEGATIVE = new Set(['lost', 'cancelled']);

export function StagePanel({
  projectId,
  currentStage,
  nextStages,
  inStageLabel,
  history,
}: {
  projectId: string;
  currentStage: string;
  nextStages: string[];
  inStageLabel: string | null;
  history: StageHistoryItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const order = PROJECT_STAGE_ORDER as readonly string[];
  const curIdx = order.indexOf(currentStage);
  const isTerminal = curIdx === -1; // lost / cancelled / archived

  const forward = nextStages.filter((s) => order.indexOf(s) > curIdx && !NEGATIVE.has(s) && s !== 'archived');
  const lateral = nextStages.filter((s) => order.indexOf(s) !== -1 && order.indexOf(s) <= curIdx);
  const negative = nextStages.filter((s) => NEGATIVE.has(s));
  const canArchive = nextStages.includes('archived');
  const primary = forward[0] ?? null;
  const secondaryForward = forward.slice(1);

  function move(stage: string, withReason?: string) {
    setErr(null);
    setBusyStage(stage);
    start(async () => {
      try {
        const res = await transitionStage(projectId, stage as Parameters<typeof transitionStage>[1], withReason ?? null);
        if (res && res.ok === false) {
          setErr(res.error ?? 'تعذّر تغيير المرحلة');
          return;
        }
        setReasonFor(null);
        setReason('');
        router.refresh();
      } catch {
        setErr('تعذّر تغيير المرحلة — تأكد من صلاحياتك');
      } finally {
        setBusyStage(null);
      }
    });
  }

  function submitReason(stage: string) {
    if (!reason.trim()) {
      setErr('اكتب السبب');
      return;
    }
    move(stage, reason.trim());
  }

  const spin = (stage: string) => pending && busyStage === stage;

  return (
    <div className="space-y-4">
      {/* ── Pipeline stepper ── */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {order.map((s, i) => {
          const done = !isTerminal && i < curIdx;
          const current = !isTerminal && i === curIdx;
          return (
            <div key={s} className="flex shrink-0 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={
                    'grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold transition-colors ' +
                    (current
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_0_3px_var(--accent-tint)]'
                      : done
                        ? 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]'
                        : 'border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--text-dim)]')
                  }
                >
                  {done ? <Check size={12} /> : i + 1}
                </div>
                <span
                  className={
                    'whitespace-nowrap text-[9px] ' +
                    (current ? 'font-semibold text-[var(--text)]' : done ? 'text-[var(--text-muted)]' : 'text-[var(--text-dim)]')
                  }
                >
                  {PROJECT_STAGE_LABELS_AR[s] ?? s}
                </span>
              </div>
              {i < order.length - 1 && (
                <div className={'mx-1 mb-4 h-px w-6 ' + (done ? 'bg-[var(--accent)]/40' : 'bg-[var(--line)]')} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Current stage + time-in-stage ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-[12px]">
        <span className="text-[var(--text-dim)]">المرحلة الحالية</span>
        <StatusPill tone={stageTone(currentStage)}>{stageLabelAr(currentStage)}</StatusPill>
        {inStageLabel && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
            <Clock size={11} /> في هذه المرحلة {inStageLabel}
          </span>
        )}
      </div>

      {/* ── Actions ── */}
      {(primary || secondaryForward.length > 0 || lateral.length > 0 || negative.length > 0 || canArchive) && (
        <div className="space-y-2.5">
          {/* Forward */}
          {(primary || secondaryForward.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {primary && (
                <button
                  onClick={() => move(primary)}
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {spin(primary) ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeft size={13} className="rtl:rotate-180" />}
                  التالي: {stageLabelAr(primary)}
                </button>
              )}
              {secondaryForward.map((s) => (
                <button
                  key={s}
                  onClick={() => move(s)}
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text)] hover:border-[var(--line-strong)] disabled:opacity-50"
                >
                  {spin(s) ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeft size={12} className="rtl:rotate-180" />}
                  {stageLabelAr(s)}
                </button>
              ))}
            </div>
          )}

          {/* Lateral / back */}
          {lateral.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[var(--text-dim)]">رجوع:</span>
              {lateral.map((s) => (
                <button
                  key={s}
                  onClick={() => move(s)}
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
                >
                  {spin(s) ? <Loader2 size={12} className="animate-spin" /> : '↩'} {stageLabelAr(s)}
                </button>
              ))}
            </div>
          )}

          {/* Negative outcomes — reason revealed on click */}
          {(negative.length > 0 || canArchive) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2.5">
              {negative.map((s) => (
                <button
                  key={s}
                  onClick={() => { setReasonFor(reasonFor === s ? null : s); setReason(''); setErr(null); }}
                  disabled={pending}
                  className={
                    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] disabled:opacity-50 ' +
                    (reasonFor === s
                      ? 'border-[var(--danger)] text-[var(--danger)]'
                      : 'border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--danger)]/60 hover:text-[var(--danger)]')
                  }
                >
                  <X size={12} /> تعليم كـ {stageLabelAr(s)}
                </button>
              ))}
              {canArchive && (
                <button
                  onClick={() => move('archived')}
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-50"
                >
                  {spin('archived') ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />} أرشفة
                </button>
              )}
            </div>
          )}

          {/* Reason input for the selected negative outcome */}
          {reasonFor && (
            <div className="flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/[0.05] p-2">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitReason(reasonFor)}
                placeholder={`سبب التعليم كـ ${stageLabelAr(reasonFor)}…`}
                className="h-8 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--danger)] focus:outline-none"
              />
              <button
                onClick={() => submitReason(reasonFor)}
                disabled={pending}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--danger)] px-3 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {spin(reasonFor) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} تأكيد
              </button>
            </div>
          )}
        </div>
      )}

      {err && <p className="text-[12px] text-[var(--danger)]">⚠ {err}</p>}

      {/* ── Recent history ── */}
      {history.length > 0 && (
        <div className="border-t border-[var(--line)] pt-3">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
            <History size={11} /> آخر التحديثات
          </p>
          <ul className="space-y-1.5">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
                {h.fromLabel && <span className="text-[var(--text-dim)]">{h.fromLabel}</span>}
                {h.fromLabel && <ArrowLeft size={10} className="text-[var(--text-dim)] rtl:rotate-180" />}
                <span className="font-medium text-[var(--text)]">{h.toLabel}</span>
                <span className="text-[var(--text-dim)]">· {h.whenLabel}</span>
                {h.byName && <span className="text-[var(--text-dim)]">· {h.byName}</span>}
                {h.reason && <span className="text-[var(--text-muted)]">— {h.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
