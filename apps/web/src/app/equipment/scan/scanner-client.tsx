'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@antagna/ui';
import { Camera, CheckCircle2, AlertCircle, X } from 'lucide-react';

type Status = 'init' | 'asking' | 'scanning' | 'found' | 'error' | 'denied';

/** Decode URLs like https://…/equipment/<uuid> → uuid. */
function extractEquipmentId(text: string): string | null {
  // Match /equipment/<uuid> with v4 uuid chars (loose — fn lookup will reject malformed).
  const m = text.match(/\/equipment\/([0-9a-fA-F-]{32,36})\b/);
  return m?.[1] ?? null;
}

export function ScannerClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('init');
  const [message, setMessage] = useState<string>('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setMessage('المتصفح لا يدعم الكاميرا.');
        return;
      }
      setStatus('asking');
      try {
        // Lazy-import @zxing/browser — heavy lib, only when this page opens.
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        const c = await reader.decodeFromVideoDevice(
          undefined, // let the lib pick default (rear on mobile)
          video,
          (result) => {
            if (cancelled || !result) return;
            const txt = result.getText();
            const eqId = extractEquipmentId(txt);
            if (eqId) {
              setStatus('found');
              setMessage(eqId);
              controls?.stop();
              // Brief flash, then navigate.
              setTimeout(() => router.push(`/equipment/${eqId}`), 500);
            }
          },
        );
        controls = c;
        if (!cancelled) setStatus('scanning');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'تعذّر فتح الكاميرا';
        if (msg.toLowerCase().includes('permission') || msg.includes('Denied')) {
          setStatus('denied');
        } else {
          setStatus('error');
        }
        setMessage(msg);
      }
    }
    void start();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [router]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    // Accept either a raw UUID or a full URL.
    const eqId = extractEquipmentId(code) ?? code;
    router.push(`/equipment/${eqId}`);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <Card padded={false}>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black sm:aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />
          {/* Aim overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={
                'h-[58%] w-[58%] rounded-2xl border-2 transition-colors ' +
                (status === 'found'
                  ? 'border-[var(--success)] shadow-[0_0_30px_var(--success)]'
                  : 'border-[var(--accent)]/70')
              }
              style={{ aspectRatio: '1' }}
            />
          </div>
          {/* Status chip */}
          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[12px] text-white backdrop-blur">
            {status === 'scanning' && (
              <>
                <Camera size={12} className="animate-pulse" /> جاري المسح…
              </>
            )}
            {status === 'asking' && (
              <>
                <Camera size={12} /> طلب صلاحية الكاميرا
              </>
            )}
            {status === 'init' && (
              <>
                <Camera size={12} /> جاهز
              </>
            )}
            {status === 'found' && (
              <>
                <CheckCircle2 size={12} /> تم — جارٍ الانتقال…
              </>
            )}
            {(status === 'error' || status === 'denied') && (
              <>
                <AlertCircle size={12} /> {status === 'denied' ? 'صلاحية مرفوضة' : 'خطأ'}
              </>
            )}
          </div>
        </div>
        {message && (status === 'error' || status === 'denied') && (
          <div className="border-t border-[var(--line)] bg-[var(--danger)]/10 px-4 py-2 text-[12px] text-[var(--danger)]">
            <X size={12} className="inline" /> {message}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 text-[14px] font-semibold text-[var(--text)]">
          إدخال يدوي
        </h3>
        <p className="mb-3 text-[12px] text-[var(--text-muted)]">
          الصق رابط المعدة أو الكود إن تعذّر المسح بالكاميرا.
        </p>
        <form onSubmit={submitManual} className="space-y-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="UUID أو رابط /equipment/…"
            dir="ltr"
            className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[12px] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="h-9 w-full rounded-md bg-[var(--accent)] text-[12px] font-semibold text-black hover:opacity-90"
          >
            افتح المعدة
          </button>
        </form>
        <div className="mt-4 space-y-1 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-dim)]">
          <p>· وجِّه الكاميرا الخلفية نحو الملصق.</p>
          <p>· التطبيق يحتاج HTTPS (مُتاح على antagna.me).</p>
          <p>· الـ QR يُولَّد من صفحة المعدة (ملصق قابل للطباعة).</p>
        </div>
      </Card>
    </div>
  );
}
