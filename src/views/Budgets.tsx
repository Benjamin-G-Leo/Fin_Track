import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, Empty, Progress, Select } from '../components/ui';
import { byCategory } from '../lib/analytics';
import { monthLabel } from '../lib/dates';
import { formatINR } from '../lib/format';
import { parseBudget } from '../lib/validate';
import { db, useData } from '../store';
import { CATEGORIES } from '../types';

const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c !== 'Salary' && c !== 'Investments');

export default function Budgets({ month }: { month: string }) {
  const { budgets, transactions } = useData();
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]!);
  const [limit, setLimit] = useState('');
  const spent = new Map(byCategory(transactions, month).map((x) => [x.name, x.value]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = parseBudget({ category, monthlyLimit: limit });
    if (!result.ok) return;
    db.budgets.set((list) => [...list.filter((b) => b.category !== category), result.value]);
    setLimit('');
  };

  return (
    <div className="space-y-4">
      <Card title="Set a monthly budget">
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <div className="w-56"><Select label="Category" value={category} options={EXPENSE_CATEGORIES} onChange={setCategory} /></div>
          <input className="field !w-48" aria-label="Monthly limit" type="number" min="1" step="0.01" required placeholder="Monthly limit (₹)" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <Button type="submit" variant="primary">Save budget</Button>
        </form>
      </Card>
      <Card title={`Budgets · ${monthLabel(month)}`}>
        {!budgets.length ? <Empty>No budgets yet. Saving one for an existing category replaces it.</Empty> : (
          <ul className="space-y-4">
            {budgets.map((b) => {
              const used = spent.get(b.category) ?? 0;
              const percent = (used / b.monthlyLimit) * 100;
              const left = b.monthlyLimit - used;
              return (
                <li key={b.category}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{b.category}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatINR(used)} of {formatINR(b.monthlyLimit)}</span>
                      <Button variant="danger" aria-label={`Delete ${b.category} budget`} onClick={() => db.budgets.set((l) => l.filter((x) => x.category !== b.category))}><Trash2 size={14} /></Button>
                    </span>
                  </div>
                  <Progress label={b.category} percent={percent} over={percent > 100} />
                  <p className={`mt-1 text-xs ${left < 0 ? 'text-danger' : percent >= 80 ? 'text-warn' : 'text-muted'}`}>
                    {left < 0 ? `Over by ${formatINR(-left)}` : `${percent >= 80 ? 'Close to limit · ' : ''}${formatINR(left)} left`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
