import type { budgetSplit } from '../lib/analytics';
import { formatINR } from '../lib/format';
import { Card, Empty, Progress } from './ui';

export default function SplitCard({ split }: { split: ReturnType<typeof budgetSplit> }) {
  return (
    <Card title="50 / 30 / 20">
      {!split.income ? <Empty>Add income for this month to see the split.</Empty> : (
        <ul className="space-y-4">
          {split.rows.map((r) => {
            // Needs and wants are ceilings; savings is a floor.
            const bad = r.name === 'Savings' ? false : r.percent > r.target;
            const short = r.name === 'Savings' && r.percent < r.target;
            return (
              <li key={r.name}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="tabular-nums">{formatINR(r.amount)}</span>
                </div>
                <Progress label={r.name} percent={r.percent} over={bad} />
                <p className={`mt-1 text-xs ${bad ? 'text-danger' : short ? 'text-warn' : 'text-muted'}`}>
                  {r.percent.toFixed(1)}% of income · {r.name === 'Savings' ? 'aim for at least' : 'limit'} {r.target}%
                  {bad && ' · over'}{short && ' · below'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
