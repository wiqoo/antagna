'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, AlertTriangle, SearchCheck } from 'lucide-react';
import { sendWhatsappMessage, resolveLidThread } from '../actions';

export function WhatsappComposer({
  threadKey,
  toE164,
}: {
  threadKey: string;
  toE164: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!toE164) {
    const isLid = threadKey.startsWith('lid:');
    return (
      <div className="border-t border-[var(--line)] px-4 py-3">
        <p className="text-[12px] text-[var(--warning)]">
          <AlertTriangle size={13} className="me-1.5 inline" />
          لا يمكن الرد — هذه المحادثة برقم محجوب (LID) ولم يُحلَّ بعد إلى رقم حقيقي.
        </p>
        {isLid && (
          <>
            {error && (
              <p className="mt-2 text-[11px] text-[var(--danger)]">{error}</p>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await resolveLidThread(threadKey);
                  if (res.ok && res.phone) {
                    router.push(`/whatsapp/${encodeURIComponent(res.phone)}`);
                  } else {
                    setError(res.error ?? 'تعذّر حل الرقم.');
                  }
                })
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              <SearchCheck size={13} />
              {pending ? 'جارٍ المحاولة…' : 'حاول حل الرقم الآن'}
            </button>
            <p className="mt-1.5 text-[10px] text-[var(--text-dim)]">
              يسأل الواتساب عن جهة الاتصال — ينجح إذا كان الرقم محفوظاً على هاتف الجلسة.
            </p>
          </>
        )}
      </div>
    );
  }

  const send = () => {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      setError(null);
      const res = await sendWhatsappMessage(threadKey, toE164, text);
      if (res.ok) {
        setBody('');
        router.refresh();
      } else {
        setError(res.error ?? 'تعذّر الإرسال');
      }
    });
  };

  return (
    <div className="border-t border-[var(--line)] p-3">
      {error && (
        <p className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-[var(--danger)]">
          <AlertTriangle size={13} /> {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
          }}
          rows={1}
          placeholder="اكتب رسالة…  (Ctrl/⌘+Enter للإرسال)"
          className="max-h-32 min-h-[40px] flex-1 resize-y rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[14px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          onClick={send}
          disabled={pending || !body.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send size={15} /> {pending ? '…' : 'إرسال'}
        </button>
      </div>
    </div>
  );
}
