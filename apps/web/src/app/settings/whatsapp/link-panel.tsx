'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card } from '@antagna/ui';
import {
  Loader2,
  RefreshCw,
  Power,
  CheckCircle2,
  Copy,
  Clock,
} from 'lucide-react';
import {
  generateMyWhatsappCode,
  cancelMyWhatsappCode,
  unlinkMyWhatsapp,
} from './actions';
import { useRouter } from 'next/navigation';

interface ActiveCode {
  code: string;
  expiresAtIso: string;
}

export function WhatsappLinkPanel({
  voltLine,
  currentE164,
  activeCode,
}: {
  voltLine: string;
  currentE164: string | null;
  activeCode: ActiveCode | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    activeCode ? Math.max(0, Math.floor((new Date(activeCode.expiresAtIso).getTime() - Date.now()) / 1000)) : 0,
  );
  const [copied, setCopied] = useState(false);

  // Countdown + auto-refresh once code expires.
  useEffect(() => {
    if (!activeCode) return;
    const t = setInterval(() => {
      const left = Math.max(
        0,
        Math.floor((new Date(activeCode.expiresAtIso).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(left);
      if (left === 0) router.refresh();
    }, 1000);
    return () => clearInterval(t);
  }, [activeCode, router]);

  // Periodic refresh so we notice the bot linked us.
  useEffect(() => {
    if (currentE164) return;
    if (!activeCode) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [activeCode, currentE164, router]);

  function generate() {
    setError(null);
    startTransition(async () => {
      const r = await generateMyWhatsappCode();
      if (!r.ok) setError(r.error ?? 'failed');
      router.refresh();
    });
  }
  function cancel() {
    startTransition(async () => {
      await cancelMyWhatsappCode();
      router.refresh();
    });
  }
  function unlink() {
    if (!confirm('متأكد إنك عاوز تفصل واتسابك؟')) return;
    startTransition(async () => {
      await unlinkMyWhatsapp();
      router.refresh();
    });
  }
  function copyCode() {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── State: already linked ──
  if (currentE164) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-[var(--success)] mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[var(--text)]">
              واتسابك مربوط
            </p>
            <p className="mt-1 font-mono text-[12px] text-[var(--text-muted)]">
              {currentE164}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-dim)]">
              Volt Bot هيرد عليك من{' '}
              <span dir="ltr" className="font-mono">{voltLine}</span>
            </p>
          </div>
          <button
            onClick={unlink}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-50"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : <Power size={11} />}
            افصل
          </button>
        </div>
      </Card>
    );
  }

  // ── State: code active ──
  if (activeCode && secondsLeft > 0) {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return (
      <Card>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)] text-center">
          الكود بتاعك
        </p>
        <div
          className="my-3 text-center font-mono text-[72px] font-bold leading-none tracking-tight"
          style={{
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {activeCode.code}
        </div>

        <div className="text-center text-[13px] text-[var(--text-muted)] mb-3">
          ابعت <span className="font-mono font-bold text-[var(--text)]">{activeCode.code}</span>{' '}
          على واتساب لـ <span dir="ltr" className="font-mono text-[var(--text)]">{voltLine}</span>
        </div>

        <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--text-dim)]">
          <Clock size={11} />
          <span>متبقي {mins}:{String(secs).padStart(2, '0')}</span>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            onClick={copyCode}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] text-[var(--text)] hover:border-[var(--accent)]"
          >
            {copied ? <CheckCircle2 size={11} className="text-[var(--success)]" /> : <Copy size={11} />}
            {copied ? 'متنسخ' : 'انسخ'}
          </button>
          <a
            href={`https://wa.me/${voltLine.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(activeCode.code)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold text-white"
            style={{ background: 'var(--accent-gradient)' }}
          >
            افتح واتساب وابعت
          </a>
          <button
            onClick={cancel}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-[var(--text-dim)]">
          الصفحة بتتحدّث كل 4 ثواني — لما الـ bot يستلم الكود تلاقي تأكيد فوراً.
        </p>
      </Card>
    );
  }

  // ── State: idle, no active code ──
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-[var(--text)]">
            ابدأ ربط واتسابك
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            هنا تولّد كود سريع تبعته على واتساب — ودي العملية كلها مرة واحدة.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent-gradient)' }}
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          وَلِّد كود
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[11px] text-[var(--danger)]">⚠ {error}</p>
      )}
    </Card>
  );
}
