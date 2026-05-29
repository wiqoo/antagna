'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, X, FileText, Loader2, MessageSquare } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import { approveApproval, rejectApproval } from './actions';

export interface ApprovalRow {
  id: string;
  deliverableId: string | null;
  stage: string;
  stageLabel: string;
  cycleNumber: number;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  versionReviewed: number | null;
  notes: string | null;
  revisionRequestText: string | null;
  reviewerName: string | null;
  deliverableTitle: string | null;
  deliverableItemNumber: string | null;
  groupNameAr: string | null;
  projectId: string | null;
  projectCode: string | null;
  projectLabel: string | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  revisions_requested: 'danger',
  skipped: 'neutral',
  auto_advanced: 'info',
};

const STATUS_LABEL_AR: Record<string, string> = {
  pending: 'بانتظار القرار',
  approved: 'مُعتمد',
  revisions_requested: 'مطلوب تعديل',
  skipped: 'تم التخطّي',
  auto_advanced: 'تقدّم تلقائي',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ar', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function deliverableLabel(r: ApprovalRow): string {
  const parts = [r.deliverableItemNumber, r.deliverableTitle].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (r.groupNameAr) return r.groupNameAr;
  return 'مخرج';
}

function ApprovalContext({ r }: { r: ApprovalRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-[var(--text)]">
        {deliverableLabel(r)}
        {r.versionReviewed != null && (
          <span className="ms-2 font-mono text-[10px] text-[var(--text-dim)]">
            v{r.versionReviewed}
          </span>
        )}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
        {r.projectId ? (
          <Link href={`/projects/${r.projectId}`} className="hover:text-[var(--accent)]">
            <span className="font-mono text-[var(--text-dim)]">{r.projectCode}</span>
            {r.projectLabel ? <span> · {r.projectLabel}</span> : null}
          </Link>
        ) : (
          <span className="italic text-[var(--text-dim)]">مشروع غير مرتبط</span>
        )}
        <span className="mx-1.5 text-[var(--text-dim)]">·</span>
        {r.stageLabel}
        {r.cycleNumber > 1 && (
          <span className="ms-1.5 text-[var(--text-dim)]">(دورة {r.cycleNumber})</span>
        )}
      </p>
    </div>
  );
}

function PendingRow({ r }: { r: ApprovalRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const run = (kind: 'approve' | 'reject') => {
    if (kind === 'reject' && !showNote) {
      // First reject click opens the note field (required-ish for revision text).
      setShowNote(true);
      return;
    }
    setErr(null);
    start(async () => {
      const fn = kind === 'approve' ? approveApproval : rejectApproval;
      const res = await fn(r.id, note.trim() || undefined);
      if (!res.ok) {
        setErr(res.error ?? 'تعذّر تسجيل القرار.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 px-5 py-4 hover:bg-[var(--bg-elevated)]/80">
      <div className="flex items-center gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]">
          <FileText size={15} />
        </span>
        <ApprovalContext r={r} />
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-[10px] text-[var(--text-dim)] sm:inline">
            {fmtDate(r.submittedAt)}
          </span>
          <button
            type="button"
            onClick={() => run('reject')}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
          >
            <X size={13} />
            طلب تعديل
          </button>
          <button
            type="button"
            onClick={() => run('approve')}
            disabled={pending}
            className="magnet inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            اعتماد
          </button>
        </div>
      </div>

      {showNote && (
        <div className="mt-3 ps-[3.25rem]">
          <div className="flex items-start gap-2">
            <MessageSquare size={14} className="mt-2 shrink-0 text-[var(--text-dim)]" />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="ملاحظة التعديل المطلوب (اختياري لكن مُستحسن)…"
              className="min-h-[2.5rem] w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => run('reject')}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--danger)] px-3.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              تأكيد طلب التعديل
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNote(false);
                setNote('');
              }}
              disabled={pending}
              className="inline-flex h-8 items-center rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {err && <p className="mt-2 ps-[3.25rem] text-[11px] text-[var(--danger)]">{err}</p>}
    </div>
  );
}

function RecentRow({ r }: { r: ApprovalRow }) {
  const decisionText = r.revisionRequestText || r.notes;
  return (
    <div className="flex items-center gap-4 border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 px-5 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]">
        <FileText size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <ApprovalContext r={r} />
        {decisionText && (
          <p className="mt-1 truncate text-[11px] italic text-[var(--text-dim)]">
            {decisionText}
          </p>
        )}
      </div>
      <div className="ms-auto flex shrink-0 flex-col items-end gap-1">
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
        <span className="text-[10px] text-[var(--text-dim)]">{fmtDate(r.reviewedAt)}</span>
      </div>
    </div>
  );
}

export function ApprovalsInbox({
  rows,
  canApprove,
  recent = false,
}: {
  rows: ApprovalRow[];
  canApprove: boolean;
  recent?: boolean;
}) {
  if (recent) {
    return (
      <div className="space-y-px stagger-in overflow-hidden rounded-lg border border-[var(--line)]">
        {rows.map((r) => (
          <RecentRow key={r.id} r={r} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-px stagger-in overflow-hidden rounded-lg border border-[var(--line)]">
      {!canApprove && (
        <p className="bg-[var(--surface)] px-5 py-2.5 text-[11px] text-[var(--text-muted)]">
          ليست لديك صلاحية اعتماد المخرجات — هذه البنود للعرض فقط.
        </p>
      )}
      {rows.map((r) =>
        canApprove ? (
          <PendingRow key={r.id} r={r} />
        ) : (
          <RecentRow key={r.id} r={r} />
        ),
      )}
    </div>
  );
}
