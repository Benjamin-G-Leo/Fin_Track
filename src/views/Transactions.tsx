import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import QuickAdd from '../components/QuickAdd';
import TransactionForm from '../components/TransactionForm';
import { Button, Card, Empty, Select } from '../components/ui';
import { dateLabel, monthKey } from '../lib/dates';
import { formatINR } from '../lib/format';
import { db, knownAccounts, useData } from '../store';
import { CATEGORIES, SPENDING_NATURES, TRANSACTION_TYPES, type Transaction } from '../types';

const PAGE = 100;

export default function Transactions({ month }: { month: string }) {
  const data = useData();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All types');
  const [category, setCategory] = useState('All categories');
  const [account, setAccount] = useState('All accounts');
  const [nature, setNature] = useState('All natures');
  const [allTime, setAllTime] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const rows = data.transactions
    .filter((t) => (allTime || monthKey(t.date) === month)
      && (type === 'All types' || t.type === type)
      && (category === 'All categories' || t.category === category)
      && (nature === 'All natures' || t.spendingNature === nature)
      && (account === 'All accounts' || t.account === account)
      && (!q || `${t.merchant} ${t.subCategory}`.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));

  const remove = (t: Transaction) => {
    if (!window.confirm(`Delete ${formatINR(t.amount)} at ${t.merchant}?`)) return;
    db.transactions.set((list) => list.filter((x) => x.id !== t.id));
  };

  return (
    <div className="space-y-4">
      <QuickAdd />
      <Card title={`Transactions (${rows.length})`}>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input className="field" aria-label="Search" placeholder="Search merchant" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select label="Type" value={type} onChange={setType} options={['All types', ...TRANSACTION_TYPES]} />
          <Select label="Category" value={category} onChange={setCategory} options={['All categories', ...CATEGORIES]} />
          <Select label="Spending nature" value={nature} onChange={setNature} options={['All natures', ...SPENDING_NATURES]} />
          <Select label="Account" value={account} onChange={setAccount} options={['All accounts', ...knownAccounts(data)]} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} />All months</label>
        </div>
        {!rows.length ? <Empty>No transactions match.</Empty> : (
          <ul className="divide-y divide-line">
            {rows.slice(0, limit).map((t) => t.id === editing ? (
              <li key={t.id} className="py-3">
                <TransactionForm initial={t} editingId={t.id} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={t.id} className="flex flex-wrap items-center justify-end gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium break-words">{t.merchant}{t.isReimbursable && <span className="ml-2 rounded border border-line px-1 text-xs text-warn">Reimbursable</span>}</p>
                  <p className="text-xs text-muted">{dateLabel(t.date)} · {t.type} · {t.category}{t.subCategory && ` / ${t.subCategory}`} · {t.spendingNature} · {t.account}</p>
                </div>
                <span className="tabular-nums whitespace-nowrap">{t.type === 'Income' ? '+' : t.type === 'Transfer' ? '' : '−'}{formatINR(t.amount)}</span>
                <Button aria-label={`Edit ${t.merchant}`} onClick={() => setEditing(t.id)}><Pencil size={14} /></Button>
                <Button variant="danger" aria-label={`Delete ${t.merchant}`} onClick={() => remove(t)}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
        {rows.length > limit && <div className="mt-3 text-center"><Button onClick={() => setLimit(limit + PAGE)}>Show more</Button></div>}
      </Card>
    </div>
  );
}
