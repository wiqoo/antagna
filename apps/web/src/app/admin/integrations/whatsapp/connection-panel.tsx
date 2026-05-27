'use client';

import { useEffect, useState } from 'react';
import { Card, StatusPill } from '@antagna/ui';
import {
  Loader2,
  RefreshCw,
  QrCode,
  Power,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type State = 'open' | 'connecting' | 'close' | 'unknown';
type Qr = { base64?: string; pairingCode?: string };
type StatusResp = {
  ok: boolean;
  state?: State;
  qr?: Qr;
  error?: string;
};

export function ConnectionPanel({
  envReady,
  ourNumber,
}: {
  envReady: boolean;
  ourNumber: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [polling, setPolling] = useState(false);

  async function refresh() {
    if (!envReady) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/whatsapp/status', {
        cache: 'no-store',
      });
      const json = (await res.json()) as StatusResp;
      setStatus(json);
      // Update QR from the response. Drop it once we leave connecting.
      if (json.state === 'connecting' && json.qr?.base64) {
        setQr(json.qr);
      } else if (json.state !== 'connecting') {
        setQr(null);
      }
    } catch (err) {
      setStatus({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  // Poll while connecting (QR is showing, waiting for scan).
  useEffect(() => {
    if (!envReady) return;
    refresh();
  }, [envReady]);

  useEffect(() => {
    if (status?.state !== 'connecting') {
      setPolling(false);
      return;
    }
    setPolling(true);
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [status?.state]);

  if (!envReady) return null;

  const state = status?.state ?? 'unknown';
  const tone =
    state === 'open' ? 'success' : state === 'connecting' ? 'warning' : 'danger';
  const label =
    state === 'open'
      ? '✓ متصل'
      : state === 'connecting'
        ? 'في انتظار QR'
        : state === 'close'
          ? 'غير متصل'
          : '—';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            حالة الاتصال
          </p>
          <div className="mt-2 flex items-center gap-2">
            <StatusPill tone={tone}>{label}</StatusPill>
            {ourNumber && (
              <span className="font-mono text-[12px] text-[var(--text-muted)]">
                {ourNumber}
              </span>
            )}
            {polling && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
                <Loader2 size={10} className="animate-spin" />
                polling…
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            تحديث
          </button>
          <PairButton onAfter={refresh} />
          <LogoutButton onAfter={refresh} />
        </div>
      </div>

      {state === 'connecting' && qr?.base64 && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
          <div className="rounded-md border border-[var(--line)] bg-white p-2">
            <img
              src={
                qr.base64.startsWith('data:')
                  ? qr.base64
                  : `data:image/png;base64,${qr.base64}`
              }
              alt="WhatsApp QR"
              className="h-48 w-48"
            />
          </div>
          <div className="text-[12px] text-[var(--text-muted)] space-y-2">
            <p className="font-semibold text-[var(--text)]">
              امسح الـ QR بهاتفك:
            </p>
            <ol className="list-inside list-decimal space-y-1">
              <li>افتح WhatsApp على الهاتف</li>
              <li>Settings → Linked Devices → Link a Device</li>
              <li>صوّر الـ QR ده</li>
            </ol>
            {qr.pairingCode && (
              <p className="mt-3 rounded border border-[var(--line)] bg-[var(--surface)]/40 p-2 font-mono text-[14px] text-[var(--accent)]">
                pairing code: {qr.pairingCode}
              </p>
            )}
          </div>
        </div>
      )}

      {state === 'open' && (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <TestSend />
        </div>
      )}

      {state === 'close' && (
        <div className="mt-3 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/[0.05] p-3 text-[12px] text-[var(--warning)]">
          الـ session مش متصلة. اضغط "اعمل Pair" يبدأ QR جديد.
        </div>
      )}

      {status?.error && (
        <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/[0.05] p-3 text-[12px] text-[var(--danger)]">
          <AlertCircle size={13} className="inline" /> {status.error}
        </div>
      )}
    </Card>
  );
}

function PairButton({ onAfter }: { onAfter: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await fetch('/api/integrations/whatsapp/pair', { method: 'POST' });
          await onAfter();
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <QrCode size={12} />}
      اعمل Pair
    </button>
  );
}

function LogoutButton({ onAfter }: { onAfter: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!confirm('تأكيد فصل الـ session؟ ستحتاج QR جديداً للعودة.')) return;
        setLoading(true);
        try {
          await fetch('/api/integrations/whatsapp/logout', { method: 'POST' });
          await onAfter();
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
      افصل
    </button>
  );
}

function TestSend() {
  const [to, setTo] = useState('+966');
  const [body, setBody] = useState('مرحبا من Antagna 👋');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  async function send() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/integrations/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        اختبار إرسال
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[200px_1fr_auto]">
        <input
          dir="ltr"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="+966501234567"
          className="h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-mono text-[var(--text)]"
        />
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="نص الرسالة"
          className="h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]"
        />
        <button
          onClick={send}
          disabled={loading || !to || !body}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent-gradient)' }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          ابعت
        </button>
      </div>
      {result && (
        <div
          className={
            'mt-2 rounded-md border p-2 text-[11px] ' +
            (result.ok
              ? 'border-[var(--success)]/30 bg-[var(--success)]/[0.05] text-[var(--success)]'
              : 'border-[var(--danger)]/40 bg-[var(--danger)]/[0.05] text-[var(--danger)]')
          }
        >
          {result.ok ? (
            <span>
              <CheckCircle2 size={12} className="inline" /> اتبعت
            </span>
          ) : (
            <span>
              <AlertCircle size={12} className="inline" /> {result.error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
