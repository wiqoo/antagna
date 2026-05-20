'use client';

import { useRef, useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';

type Item = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export function FileUpload({
  entityType,
  entityId,
  initial = [],
  onChange,
}: {
  entityType: string;
  entityId: string;
  initial?: Item[];
  onChange?: () => void;
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const signRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          entityType,
          entityId,
        }),
      });
      if (!signRes.ok) {
        const body = await signRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'sign_failed');
      }
      const { signedUrl, attachmentId } = (await signRes.json()) as {
        signedUrl: string;
        attachmentId: string;
      };

      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: file,
      });
      if (!putRes.ok) throw new Error('upload_failed');

      await fetch(`/api/upload?confirm=1&attachmentId=${attachmentId}`, {
        method: 'POST',
      });

      setItems((prev) => [
        ...prev,
        {
          id: attachmentId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      ]);
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('احذف الملف؟')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/upload?attachmentId=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('delete_failed');
      setItems((prev) => prev.filter((i) => i.id !== id));
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  async function openSigned(id: string) {
    const res = await fetch(`/api/upload?attachmentId=${id}`);
    if (!res.ok) return;
    const { url } = (await res.json()) as { url: string };
    window.open(url, '_blank', 'noopener');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="magnet inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Upload size={13} />
          )}
          {busy ? 'يرفع…' : 'رفع ملف'}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {error && (
          <span className="text-[11px] text-[var(--danger)]">⚠ {error}</span>
        )}
      </div>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3 py-2"
            >
              <FileText size={14} className="text-[var(--text-dim)]" />
              <button
                type="button"
                onClick={() => openSigned(it.id)}
                className="flex-1 truncate text-start text-[12px] text-[var(--text)] hover:text-[var(--accent)]"
              >
                {it.filename}
              </button>
              <span className="font-mono text-[10px] text-[var(--text-dim)]">
                {(it.sizeBytes / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => handleDelete(it.id)}
                title="حذف"
                disabled={busy}
                className="grid h-6 w-6 place-items-center rounded-md text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
