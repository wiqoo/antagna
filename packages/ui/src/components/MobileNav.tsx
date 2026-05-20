'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';

export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="فتح القائمة"
        className="md:hidden grid h-9 w-9 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
      >
        <Menu size={18} />
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 end-0 w-[280px] max-w-[80vw] overflow-y-auto border-s border-[var(--line)] bg-[var(--bg)] shadow-[0_0_60px_rgba(0,0,0,0.15)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--line)] px-3">
              <span className="text-[11px] font-medium text-[var(--text-dim)]">
                القائمة
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <X size={16} />
              </button>
            </div>
            <div onClick={() => setOpen(false)}>{children}</div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
