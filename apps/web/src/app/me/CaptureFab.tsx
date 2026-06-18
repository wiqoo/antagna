'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { captureItem } from './actions';

// Frictionless capture: floating button → sheet with text + voice (Web Speech).
export function CaptureFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 50);
  }, [open]);

  function toggleVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('التسجيل الصوتي غير مدعوم في هذا المتصفح'); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.interimResults = true;
    rec.continuous = false;
    let base = text ? text + ' ' : '';
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      let s = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r && r[0]) s += r[0].transcript;
      }
      setText(base + s);
    };
    rec.onend = () => { setListening(false); base = ''; };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function submit(source: 'text' | 'voice') {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('content', content);
      fd.set('source', source);
      await captureItem(fd);
      setText('');
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="التقاط"
        className="fixed bottom-20 left-1/2 z-40 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-[var(--accent)] text-[26px] font-light text-[#1a1a1a] shadow-lg active:scale-95"
        style={{ boxShadow: '0 8px 24px rgba(255,107,26,.4)' }}
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => !busy && setOpen(false)}>
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl border-t border-[var(--line-strong)] bg-[var(--surface)] p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold">التقاط سريع</h3>
              <button onClick={() => setOpen(false)} className="text-[var(--text-dim)]">✕</button>
            </div>
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="أي حاجة في دماغك… ارميها هنا"
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={toggleVoice}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-[18px]"
                style={{
                  borderColor: listening ? 'var(--accent)' : 'var(--line-strong)',
                  background: listening ? 'var(--accent)' : 'transparent',
                  color: listening ? '#1a1a1a' : 'var(--text-muted)',
                }}
              >
                🎤
              </button>
              <button
                onClick={() => submit(listening ? 'voice' : 'text')}
                disabled={busy || !text.trim()}
                className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[#1a1a1a] disabled:opacity-40"
              >
                {busy ? 'جارٍ…' : 'إضافة للوارد'}
              </button>
            </div>
            {listening && <p className="mt-2 text-center text-[12px] text-[var(--accent)]">🔴 بيسمعك… اتكلم</p>}
          </div>
        </div>
      )}
    </>
  );
}
