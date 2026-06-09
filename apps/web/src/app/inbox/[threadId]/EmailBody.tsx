'use client';

import { useState } from 'react';

/**
 * Clean email reading pane: shows the actual reply, with the quoted history
 * (the "> On … wrote:" / "From: …" chain that bloats most emails) collapsed
 * behind an expander — Superhuman-style. Plain text only (no HTML/XSS).
 */
const QUOTE_RE =
  /\n[ \t]*(?:>|On .+ wrote:|في .+ كتب[:]?|-{2,}\s*Original Message|-{2,}\s*الرسالة الأصلية|_{5,}|From:[ \t].+\r?\n(?:Sent|To|Date|Subject|إلى|التاريخ):|من:[ \t].+\r?\n(?:إلى|التاريخ|الموضوع):)/;

export function EmailBody({ text }: { text: string }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const m = text.match(QUOTE_RE);
  const idx = m?.index ?? -1;
  const main = (idx >= 0 ? text.slice(0, idx) : text).trimEnd();
  const quoted = idx >= 0 ? text.slice(idx).trim() : '';

  return (
    <div
      dir="auto"
      className="mt-2 max-h-[440px] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3.5 py-3 text-[13.5px] leading-[1.85] text-[var(--text)]"
    >
      <div className="whitespace-pre-wrap">{main || '(فارغة)'}</div>
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
