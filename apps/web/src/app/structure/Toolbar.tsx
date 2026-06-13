'use client';

import { useRef } from 'react';
import type { OrgNode } from './org-data';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  scale: number;
  saveState: SaveState;
  nodes: OrgNode[];
  onFit: () => void;
  onZoom: (dir: number) => void;
  onAddTop: () => void;
  onOpenSuggestions: () => void;
  onImport: (nodes: OrgNode[]) => boolean;
  onExportPng: () => void;
  onPrint: () => void;
}

const btn =
  'flex items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: 'جارٍ الحفظ…',
  saved: 'محفوظ ✓',
  error: 'خطأ في الحفظ',
};

export function Toolbar({
  scale,
  saveState,
  nodes,
  onFit,
  onZoom,
  onAddTop,
  onOpenSuggestions,
  onImport,
  onExportPng,
  onPrint,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'volt-org-chart.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const arr = Array.isArray(parsed) ? parsed : parsed?.nodes;
        if (!Array.isArray(arr) || !onImport(arr)) {
          alert('ملف غير صالح — لا بد أن يكون مصفوفة عُقد بجذر واحد.');
        }
      } catch {
        alert('تعذّرت قراءة الملف.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)]/85 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2 pe-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[14px] font-bold text-[#1a1a1a]">
          V
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold">الهيكل التنظيمي</p>
          <p className="text-[10px] text-[var(--text-dim)]">Volt Production</p>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-[var(--line)]" />

      <button className={btn} onClick={onAddTop}>+ موظف</button>
      <button className={btn} onClick={onOpenSuggestions}>✦ أدوار مقترحة</button>

      <div className="mx-1 h-6 w-px bg-[var(--line)]" />

      <button className={btn} onClick={() => onZoom(-1)}>−</button>
      <span className="min-w-[42px] text-center text-[12px] tabular-nums text-[var(--text-dim)]">
        {Math.round(scale * 100)}%
      </span>
      <button className={btn} onClick={() => onZoom(1)}>+</button>
      <button className={btn} onClick={onFit}>⤢ ملء الشاشة</button>

      <div className="mx-1 h-6 w-px bg-[var(--line)]" />

      <button className={btn} onClick={exportJson}>JSON ↓</button>
      <button className={btn} onClick={() => fileRef.current?.click()}>JSON ↑</button>
      <button className={btn} onClick={onExportPng}>PNG</button>
      <button className={btn} onClick={onPrint}>طباعة</button>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} />

      <span className="ms-auto text-[11px] text-[var(--text-dim)]">{SAVE_LABEL[saveState]}</span>
    </div>
  );
}
