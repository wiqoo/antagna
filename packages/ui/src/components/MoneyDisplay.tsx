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
    return <span className={`text-[--text-dim] ${className ?? ''}`}>—</span>;
  }
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) {
    return <span className={`text-[--text-dim] ${className ?? ''}`}>—</span>;
  }
  const hasFraction = Math.abs(n) % 1 > 0;
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return (
    <span className={`font-mono tabular-nums ${className ?? ''}`}>
      <span className="text-[--text-dim]">{currency}</span>{' '}
      <span className="text-[--text]">{formatted}</span>
    </span>
  );
}
