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
    return <span className={`text-[var(--text-dim)] ${className ?? ''}`}>—</span>;
  }
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) {
    return <span className={`text-[var(--text-dim)] ${className ?? ''}`}>—</span>;
  }
  const hasFraction = Math.abs(n) % 1 > 0;
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return (
    <span className={`tabular ${className ?? ''}`}>
      <span className="text-[var(--text)]">{formatted}</span>{' '}
      <span className="text-[10px] text-[var(--text-dim)]">{currency}</span>
    </span>
  );
}
