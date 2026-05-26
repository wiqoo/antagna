'use client';

/**
 * Small count-up for headline numbers. Eases from 0 → value once on mount and
 * formats with Arabic-Indic digits to match the cards. Respects reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { toAr } from './utils';

export function CountUp({
  value,
  suffix,
  durationMs = 750,
  className,
}: {
  value: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const [n, setN] = useState(value);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || value === 0) { setN(value); return; }

    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, durationMs]);

  return <span className={className}>{toAr(Math.round(n))}{suffix}</span>;
}
