'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Languages, Loader2 } from 'lucide-react';

/**
 * Clean email reading pane:
 * 1. Collapses the quoted "> On … wrote:" / "From:" history behind an expander.
 * 2. In English mode, auto-translates an Arabic email body to English (marked
 *    "translated") with a "Show original" toggle. Opts out of the global
 *    TranslateLayer (data-i18n-skip) so it owns its own AR↔EN switch.
 */
const QUOTE_RE =
  /\n[ \t]*(?:>|On .+ wrote:|في .+ كتب[:]?|-{2,}\s*Original Message|-{2,}\s*الرسالة الأصلية|_{5,}|From:[ \t].+\r?\n(?:Sent|To|Date|Subject|إلى|التاريخ):|من:[ \t].+\r?\n(?:إلى|التاريخ|الموضوع):)/;
const HAS_ARABIC = /[؀-ۿ]/;

export function EmailBody({ text }: { text: string }) {
  const locale = useLocale();
  const [showQuoted, setShowQuoted] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const m = text.match(QUOTE_RE);
  const idx = m?.index ?? -1;
  const main = (idx >= 0 ? text.slice(0, idx) : text).trimEnd();
  const quoted = idx >= 0 ? text.slice(idx).trim() : '';
  const needsTranslation = locale === 'en' && HAS_ARABIC.test(main);

  useEffect(() => {
    if (!needsTranslation) return;
    let alive = true;
    setLoading(true);
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts: [main.trim()], to: 'en', domain: 'email' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { translations?: Record<string, string> } | null) => {
        if (alive && j?.translations) setTranslated(j.translations[main.trim()] ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [needsTranslation, main]);

  const showTranslated = needsTranslation && translated && !showOriginal;
  const bodyToShow = showTranslated ? translated! : main;

  return (
    <div
      dir="auto"
      data-i18n-skip
      className="mt-2 max-h-[440px] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3.5 py-3 text-[13.5px] leading-[1.85] text-[var(--text)]"
    >
      {needsTranslation && (
        <div className="mb-2 flex items-center gap-2 border-b border-[var(--line)] pb-1.5 text-[10px] text-[var(--text-dim)]">
          {loading ? (
            <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> يترجم…</span>
          ) : translated ? (
            <span className="inline-flex items-center gap-1 text-[var(--accent)]"><Languages size={10} /> {showTranslated ? 'مُترجَم آلياً' : 'الأصلي (عربي)'}</span>
          ) : null}
          {translated && (
            <button type="button" onClick={() => setShowOriginal((v) => !v)} className="hover:text-[var(--accent)]">
              {showTranslated ? 'إظهار الأصلي · Show original' : 'إظهار الترجمة · Show translation'}
            </button>
          )}
        </div>
      )}

      <div className="whitespace-pre-wrap">{bodyToShow || '(فارغة)'}</div>

      {quoted && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowQuoted((v) => !v)}
            className="text-[11px] text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
          >
            {showQuoted ? '▲ إخفاء المقتبس' : '⋯ عرض الرسائل المقتبسة'}
          </button>
          {showQuoted && (
            <div className="mt-1.5 whitespace-pre-wrap border-s-2 border-[var(--line)] ps-3 text-[12px] leading-[1.7] text-[var(--text-dim)]">
              {quoted}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
