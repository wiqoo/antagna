'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'antagna-a2hs-dismissed';

/**
 * Custom "Add to home screen" prompt. Captures the browser's
 * `beforeinstallprompt`, suppresses the default mini-infobar, and shows a
 * DNA-styled card the user can act on or dismiss (remembered in localStorage).
 * Renders nothing unless the app is actually installable.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || !deferred) return null;

  const install = async () => {
    setHidden(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user cancelled */
    }
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-white/[0.1] bg-[#17171C] p-3 shadow-2xl shadow-black/40 sm:inset-x-auto sm:right-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#FF6B1A] to-[#FF8A3D] text-[15px] font-bold text-black">
        A
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-white">ثبّت تطبيق Antagna</p>
        <p className="truncate text-[12px] text-white/50">
          وصول أسرع من شاشتك الرئيسية ويعمل جزئياً دون اتصال.
        </p>
      </div>
      <button
        onClick={install}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#FF6B1A] px-3 py-1.5 text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
      >
        <Download size={13} /> تثبيت
      </button>
      <button
        onClick={dismiss}
        aria-label="إغلاق"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
