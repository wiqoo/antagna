'use client';

import { useEffect, useRef, useState } from 'react';

type FormatKey = 'plain' | 'k' | 'sar' | 'pct' | 'days';

type Props = {
  to: number;
  durationMs?: number;
  format?: FormatKey;
  className?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Always en-US Latin digits + grouping commas, regardless of the user's locale.
// Mohammed's audit hit a "9.688" display where a stray float in a stat tile was
// rendered with the browser-default decimal/grouping convention — locking the
// default branch to maximumFractionDigits: 0 keeps every tile consistent.
function formatValue(n: number, key: FormatKey | undefined): string {
  switch (key) {
    case 'k':
      return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toLocaleString('en-US');
    case 'sar':
      return `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'pct':
      return `${Math.round(n)}%`;
    case 'days':
      return `${n.toFixed(1)}`;
    default:
      return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}

export function Counter({
  to,
  durationMs = 900,
  format,
  className,
}: Props) {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let frame: number;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      setVal(to * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, durationMs]);

  return <span className={className}>{formatValue(val, format)}</span>;
}
