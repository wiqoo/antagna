'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendAssistantMessage } from '../actions3';

// The chief-of-staff input bar: text + voice, pinned above the bottom nav.
export function Chat({ suggestions }: { suggestions: string[] }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => {
    // keep the thread scrolled to the newest message
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  function toggleVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('التسجيل الصوتي غير مدعوم في هذا المتصفح'); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = 'ar-SA'; rec.interimResults = true; rec.continuous = false;
    const base = text ? text + ' ' : '';
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      let s = '';
      for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; if (r && r[0]) s += r[0].transcript; }
      setText(base + s);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  }

  async function send(msg?: string) {
    const content = (msg ?? text).trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('message', content);
      await sendAssistantMessage(fd);
      setText('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {suggestions.length > 0 && !busy && (
        <div className="fixed inset-x-0 bottom-[112px] z-30 mx-auto flex max-w-md gap-2 overflow-x-auto px-4 pb-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="shrink-0 whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--text-muted)]">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[58px] z-30 mx-auto max-w-md border-t border-[var(--line)] bg-[var(--bg)]/95 px-3 py-2.5 backdrop-blur">
        {busy && <p className="mb-1.5 px-1 text-[11px] text-[var(--accent)]">المساعد بيفكّر…</p>}
        {listening && <p className="mb-1.5 px-1 text-[11px] text-[var(--accent)]">🔴 بيسمعك… اتكلم</p>}
        <div className="flex items-end gap-2">
          <button onClick={toggleVoice} disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-[17px]"
            style={{ borderColor: listening ? 'var(--accent)' : 'var(--line-strong)', background: listening ? 'var(--accent)' : 'transparent', color: listening ? '#1a1a1a' : 'var(--text-muted)' }}>
            🎤
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="اكتب أو اتكلم مع مساعدك…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <button onClick={() => send()} disabled={busy || !text.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-[18px] text-[#1a1a1a] disabled:opacity-40">
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
