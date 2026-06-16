'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setFinal } from '../actions';
import { portalSetFinal } from '../portal-actions';

/**
 * Uploads the FINAL deliverable straight to the system (Supabase Storage) via
 * the shared two-step /api/upload protocol, then links it to the job. Volt then
 * previews + downloads it (rendered by the parent from a signed URL).
 */
export function FinalUpload({ jobId, hasFinal, mode = 'volt' }: { jobId: string; hasFinal: boolean; mode?: 'volt' | 'partner' }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      // 1) ask the server for a signed upload URL + a pending attachment row
      const signRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          entityType: 'external_job_final',
          entityId: jobId,
        }),
      });
      const signed = await signRes.json();
      if (!signRes.ok || !signed?.signedUrl || !signed?.attachmentId) {
        throw new Error(signed?.error || 'تعذّر بدء الرفع');
      }
      // 2) PUT the bytes straight to storage
      const put = await fetch(signed.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error('فشل رفع الملف');
      // 3) link it to the job + mark delivered (scoped by perspective)
      if (mode === 'partner') await portalSetFinal(jobId, signed.attachmentId);
      else await setFinal(jobId, signed.attachmentId);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطأ غير متوقع');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div>
      <input ref={ref} type="file" hidden onChange={onPick} disabled={busy} />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50"
      >
        {busy ? 'جارٍ الرفع…' : hasFinal ? '↻ استبدال الفاينل' : '⬆ رفع الفاينل'}
      </button>
      {err && <p className="mt-1.5 text-[11px] text-[var(--danger)]">{err}</p>}
    </div>
  );
}
