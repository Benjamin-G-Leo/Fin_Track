import { useState, type FormEvent } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { saveTransaction } from '../components/TransactionForm';
import { Button, Card, Empty, Field, Select } from '../components/ui';
import { addMonths, dateLabel, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { matchRule } from '../lib/rules';
import { defaultNature, oneOf, parseBill } from '../lib/validate';
import { db, knownAccounts, useData } from '../store';
import { CATEGORIES, FREQUENCIES, type Frequency, type RecurringBill } from '../types';

const STEP: Record<Frequency, number> = { Monthly: 1, Quarterly: 3, Yearly: 12 };
const empty = () => ({ id: '', name: '', amount: '', frequency: 'Monthly', nextDueDate: todayISO(), category: 'Utilities & Bills', account: 'HDFC UPI' });

export default function Bills() {
  const data = useData();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const set = (key: keyof ReturnType<typeof empty>) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const monthly = data.bills.reduce((a, b) => a + b.amount / STEP[b.frequency], 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = parseBill(form);
    if (!result.ok) return setError(result.error);
    db.bills.set((l) => (form.id ? l.map((b) => (b.id === form.id ? result.value : b)) : [...l, result.value]));
    setForm(empty()); setError('');
  };

  const pay = (bill: RecurringBill) => {
    if (!window.confirm(`Record ${formatINR(bill.amount)} paid today for ${bill.name}?`)) return;
    const category = oneOf(bill.category, CATEGORIES) ?? 'Other';
    const rule = matchRule(bill.name, data.rules);
    const type = category === 'Investments' ? 'Investment' : 'Expense';
    const saved = saveTransaction({
      date: todayISO(), type, amount: bill.amount, category, merchant: bill.name, account: bill.account, isReimbursable: false,
      subCategory: rule?.category === category ? rule.subCategory : 'Recurring', spendingNature: defaultNature(type, category),
    });
    if (saved) db.bills.set((l) => l.map((b) => (b.id === bill.id ? { ...b, nextDueDate: addMonths(b.nextDueDate, STEP[b.frequency]) } : b)));
  };

  return (
    <div className="space-y-4">
      <Card title={form.id ? 'Edit recurring bill' : 'Add recurring bill'}>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name"><input className="field" required value={form.name} onChange={(e) => set('name')(e.target.value)} /></Field>
          <Field label="Amount (₹)"><input className="field" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => set('amount')(e.target.value)} /></Field>
          <Field label="Frequency"><Select value={form.frequency} options={FREQUENCIES} onChange={set('frequency')} /></Field>
          <Field label="Next due date"><input className="field" type="date" required value={form.nextDueDate} onChange={(e) => set('nextDueDate')(e.target.value)} /></Field>
          <Field label="Category"><Select value={form.category} options={CATEGORIES} onChange={set('category')} /></Field>
          <Field label="Account"><Select value={form.account} options={knownAccounts(data)} onChange={set('account')} /></Field>
          <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-3">
            {error && <span role="alert" className="text-sm text-danger">{error}</span>}
            {form.id && <Button onClick={() => setForm(empty())}>Cancel</Button>}
            <Button type="submit" variant="primary">{form.id ? 'Save changes' : 'Add bill'}</Button>
          </div>
        </form>
      </Card>
      <Card title="Recurring bills" action={<span className="text-sm text-muted">≈ {formatINR(monthly)} per month</span>}>
        {!data.bills.length ? <Empty>No recurring bills yet.</Empty> : (
          <ul className="divide-y divide-line">
            {[...data.bills].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{b.name}</p>
                  <p className={`text-xs ${b.nextDueDate < todayISO() ? 'text-danger' : 'text-muted'}`}>
                    {b.nextDueDate < todayISO() ? 'Overdue' : 'Due'} {dateLabel(b.nextDueDate)} · {b.frequency} · {b.category} · {b.account}
                  </p>
                </div>
                <span className="tabular-nums">{formatINR(b.amount)}</span>
                <Button onClick={() => pay(b)}><Check size={14} />Paid</Button>
                <Button aria-label={`Edit ${b.name}`} onClick={() => setForm({ ...b, amount: String(b.amount) })}><Pencil size={14} /></Button>
                <Button variant="danger" aria-label={`Delete ${b.name}`} onClick={() => { if (window.confirm(`Delete ${b.name}?`)) db.bills.set((l) => l.filter((x) => x.id !== b.id)); }}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
