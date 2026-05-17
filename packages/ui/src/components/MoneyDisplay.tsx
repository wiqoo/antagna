/**
 * Renders SAR amounts with mono font and Volt's convention:
 *   SAR 15,000        — whole SAR (no decimals when .00)
 *   SAR 15,000.50     — with halalas when present
 *   —                 — when amount is null/undefined
 */
export function MoneyDisplay({
  amount,
  currency = 'SAR',
  className,
}: {
  amount: number | string | null | undefined;
  currency?: string;
  className?: string;
}) {
  if (amount == null || amount === '') {
    return <span className={`font-mono text-neutral-500 ${className ?? ''}`}>—</span>;
  }
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) {
    return <span className={`font-mono text-neutral-500 ${className ?? ''}`}>—</span>;
  }
  const hasFraction = Math.abs(n) % 1 > 0;
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return (
    <span className={`font-mono tabular-nums ${className ?? ''}`}>
      <span className="text-neutral-500">{currency}</span> {formatted}
    </span>
  );
}
