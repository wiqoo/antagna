'use client';

import { useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, X, Loader2, Archive, History, Clock, ChevronDown, GitBranch } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import {
  PROJECT_STAGE_ORDER,
  stageLabel,
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
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const order = PROJECT_STAGE_ORDER as readonly string[];
  const curIdx = order.indexOf(currentStage);
  const isTerminal = curIdx === -1; // lost / cancelled / archived

  const forward = nextStages.filter((s) => order.indexOf(s) > curIdx && order.indexOf(s) !== -1);
  const lateral = nextStages.filter((s) => order.indexOf(s) !== -1 && order.indexOf(s) <= curIdx);
  const primary = forward[0] ?? null;
  // The dropdown is a full stage picker — every valid move (forward + back).
  const menuStages = [...forward, ...lateral];
  const canCancel = nextStages.includes('cancelled'); // "فاشل" removed per request — only "ملغى"
  const canArchive = nextStages.includes('archived');

  const progress = isTerminal ? 100 : Math.round((curIdx / (order.length - 1)) * 100);

  function move(stage: string, withReason?: string) {
    setErr(null);
    setBusyStage(stage);
    setMenuOpen(false);
    start(async () => {
      try {
        const res = await transitionStage(projectId, stage as Parameters<typeof transitionStage>[1], withReason ?? null);
        if (res && res.ok === false) {
          setErr(res.error ?? 'تعذّر تغيير المرحلة');
          return;
        }
        setReasonOpen(false);
        setReason('');
        router.refresh();
      } catch {
        setErr('تعذّر تغيير المرحلة — تأكد من صلاحياتك');
      } finally {
        setBusyStage(null);
      }
    });
  }

  const spin = (stage: string) => pending && busyStage === stage;

  return (
    <div className="space-y-4">
      {/* ── Pipeline timeline ── */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-start">
          {order.map((s, i) => {
            const done = !isTerminal && i < curIdx;
            const current = !isTerminal && i === curIdx;
            const connectorDone = !isTerminal && i < curIdx; // the link AFTER dot i (toward i+1)
            return (
              <div key={s} className="flex shrink-0 items-start">
                <div className="flex w-[58px] flex-col items-center gap-1.5">
                  <div className="relative grid h-9 place-items-center">
                    <div
                      className={
                        'grid place-items-center rounded-full text-[11px] font-bold transition-all duration-300 ' +
                        (current
                          ? 'h-8 w-8 bg-[var(--accent)] text-white shadow-[0_0_0_4px_var(--accent-tint),0_2px_10px_rgba(255,107,26,0.45)]'
                          : done
                            ? 'h-7 w-7 bg-[var(--accent)] text-white'
                            : 'h-7 w-7 border border-[var(--line-strong)] bg-[var(--bg-elevated)] text-[var(--text-dim)]')
                      }
                    >
                      {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </div>
                  </div>
                  <span
                    className={
                      'whitespace-nowrap text-[10px] leading-tight transition-colors ' +
                      (current ? 'font-bold text-[var(--text)]' : done ? 'text-[var(--text-muted)]' : 'text-[var(--text-dim)]')
                    }
                  >
                    {stageLabel(s, locale)}
                  </span>
                </div>
                {i < order.length - 1 && (
                  <div className="mt-[14px] h-[3px] w-7 overflow-hidden rounded-full bg-[var(--line)]">
                    <div
                      className={'h-full rounded-full transition-all duration-500 ' + (connectorDone ? 'w-full bg-gradient-to-l from-[var(--accent)] to-[var(--accent)]/70' : 'w-0')}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Current stage + progress ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-[12px]">
        <span className="text-[var(--text-dim)]">المرحلة الحالية</span>
        <StatusPill tone={stageTone(currentStage)}>{stageLabel(currentStage, locale)}</StatusPill>
        {!isTerminal && (
          <span className="text-[11px] text-[var(--text-dim)]">
            · {curIdx + 1} من {order.length} ({progress}%)
          </span>
        )}
        {inStageLabel && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
            <Clock size={11} /> منذ {inStageLabel}
          </span>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        {primary && (
          <button
            onClick={() => move(primary)}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {spin(primary) ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeft size={13} className="rtl:rotate-180" />}
            التالي: {stageLabel(primary, locale)}
          </button>
        )}

        {/* Stage picker dropdown */}
        {menuStages.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text)] transition-colors hover:border-[var(--line-strong)] disabled:opacity-50"
            >
              <GitBranch size={13} className="text-[var(--text-dim)]" /> نقل إلى مرحلة
              <ChevronDown size={13} className={'text-[var(--text-dim)] transition-transform ' + (menuOpen ? 'rotate-180' : '')} />
            </button>
            {menuOpen && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} aria-hidden tabIndex={-1} />
                <div className="absolute z-20 mt-1 w-52 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
                  {menuStages.map((s) => {
                    const isForward = order.indexOf(s) > curIdx;
                    return (
                      <button
                        key={s}
                        onClick={() => move(s)}
                        disabled={pending}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[12px] text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {spin(s) ? <Loader2 size={12} className="animate-spin" /> : isForward ? <ArrowLeft size={12} className="text-[var(--accent)] rtl:rotate-180" /> : <span className="text-[var(--text-dim)]">↩</span>}
                          {stageLabel(s, locale)}
                        </span>
                        <span className="text-[9px] text-[var(--text-dim)]">{isForward ? 'تقدّم' : 'رجوع'}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Cancel (only) + archive — pushed to the end */}
        {(canCancel || canArchive) && (
          <div className="ms-auto flex items-center gap-2">
            {canCancel && (
              <button
                onClick={() => { setReasonOpen((v) => !v); setReason(''); setErr(null); }}
                disabled={pending}
                className={
                  'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] transition-colors disabled:opacity-50 ' +
                  (reasonOpen ? 'border-[var(--danger)] text-[var(--danger)]' : 'border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--danger)]/60 hover:text-[var(--danger)]')
                }
              >
                <X size={13} /> تعليم كمُلغى
              </button>
            )}
            {canArchive && (
              <button
                onClick={() => move('archived')}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text-dim)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
              >
                {spin('archived') ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />} أرشفة
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reason input for cancellation */}
      {reasonOpen && canCancel && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/[0.05] p-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && reason.trim() && move('cancelled', reason.trim())}
            placeholder="سبب الإلغاء…"
            className="h-8 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--danger)] focus:outline-none"
          />
          <button
            onClick={() => (reason.trim() ? move('cancelled', reason.trim()) : setErr('اكتب السبب'))}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--danger)] px-3 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {spin('cancelled') ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} تأكيد الإلغاء
          </button>
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
