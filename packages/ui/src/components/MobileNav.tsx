'use client';

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Close on route change (rough: close on history change)
  useEffect(() => {
    const handler = () => setOpen(false);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Lock scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on ESC
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
        className="md:hidden grid h-10 w-10 place-items-center rounded-xl border border-[--line] bg-[--surface] text-[--text]"
      >
        <Menu size={18} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 end-0 z-50 w-72 overflow-y-auto border-s border-[--line] bg-[--bg-elevated] shadow-2xl md:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-14 items-center justify-between border-b border-[--line] px-4">
              <span className="text-base font-semibold">القائمة</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="grid h-9 w-9 place-items-center rounded-xl text-[--text-muted] hover:bg-[--surface] hover:text-[--text]"
              >
                <X size={18} />
              </button>
            </div>
            <div onClick={() => setOpen(false)}>{children}</div>
          </aside>
        </>
      )}
    </>
  );
}
