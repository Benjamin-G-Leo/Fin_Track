import { safeToSpend } from '../lib/analytics';
import { monthKey, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { useStored } from '../lib/storage';
import { savingsTarget, useData } from '../store';
import { Card, Empty, Field } from './ui';

export default function SafeToSpend({ month }: { month: string }) {
  const { transactions, bills } = useData();
  const target = useStored(savingsTarget);
  const today = todayISO();
  if (month !== monthKey(today)) {
    return <Card title="Safe to spend"><Empty>Shown for the current month only.</Empty></Card>;
  }
  const s = safeToSpend(transactions, bills, target, today);
  const lines = [
    ['Monthly income', s.income], ['Upcoming bills', -s.fixedBills],
    ['Savings target', -s.savings], ['Personal expenses', -s.expense],
  ] as const;
  return (
    <Card title="Safe to spend">
      <p className="text-3xl font-bold">{formatINR(s.daily)}<span className="text-sm font-normal text-muted"> / day</span></p>
      <p className={`text-xs ${s.remaining < 0 ? 'text-danger' : 'text-muted'}`}>
        {s.remaining < 0 ? `Over by ${formatINR(-s.remaining)} this month` : `${formatINR(s.remaining)} over ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`}
        {!s.income && ' · add this month’s income to get an allowance'}
      </p>
      <dl className="my-3 text-sm">
        {lines.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2"><dt className="text-muted">{label}</dt><dd className="tabular-nums">{value < 0 ? '−' : ''}{formatINR(Math.abs(value))}</dd></div>
        ))}
      </dl>
      <Field label="Monthly savings target (₹), blank = 20% of income">
        <input className="field" type="number" min="0" step="500" value={target || ''} onChange={(e) => savingsTarget.set(Math.max(0, Number(e.target.value) || 0))} />
      </Field>
    </Card>
  );
}
