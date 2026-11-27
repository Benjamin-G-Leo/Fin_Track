import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthLabel } from '../lib/dates';
import { formatINR, formatINRCompact } from '../lib/format';
import { Button, Card, Empty } from './ui';

const tick = { fill: 'var(--muted)', fontSize: 12 };
const tooltip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 },
  labelStyle: { color: 'var(--ink)' }, itemStyle: { color: 'var(--ink)' },
  cursor: { fill: 'var(--line)', opacity: 0.4 },
};

/** Every chart has a table twin so values never depend on colour or hover. */
function ChartCard({ title, head, rows, empty, children }: {
  title: string; head: string[]; rows: (string | number)[][]; empty: boolean; children: ReactNode;
}) {
  const [table, setTable] = useState(false);
  return (
    <Card title={title} action={!empty && <Button onClick={() => setTable(!table)}>{table ? 'Chart' : 'Table'}</Button>}>
      {empty ? <Empty>No data for this period yet.</Empty> : table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{head.map((h, i) => <th key={h} className={`py-1 ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r[0]} className="border-t border-line">
                {r.map((c, i) => <td key={i} className={`py-1 ${i ? 'text-right tabular-nums' : ''}`}>{typeof c === 'number' ? formatINR(c) : c}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : children}
    </Card>
  );
}

export function TrendChart({ data }: { data: { month: string; income: number; expense: number; invested: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <ChartCard title="Last 6 months" head={['Month', 'Income', 'Expenses', 'Invested']}
      rows={rows.map((r) => [r.label, r.income, r.expense, r.invested])}
      empty={rows.every((r) => !r.income && !r.expense && !r.invested)}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} barGap={2}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={64} tickFormatter={formatINRCompact} />
          <Tooltip {...tooltip} formatter={(v) => formatINR(Number(v))} />
          <Legend itemSorter={null} formatter={(v) => <span style={{ color: 'var(--ink)' }}>{v}</span>} />
          <Bar name="Income" dataKey="income" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar name="Expenses" dataKey="expense" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar name="Invested" dataKey="invested" fill="var(--series-3)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BreakdownChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <ChartCard title={title} head={['Name', 'Spent']} rows={data.map((d) => [d.name, d.value])} empty={!data.length}>
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 38)}>
        <BarChart data={data} layout="vertical" margin={{ right: 16 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} width={118} />
          <Tooltip {...tooltip} formatter={(v) => [formatINR(Number(v)), 'Spent']} />
          <Bar dataKey="value" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
