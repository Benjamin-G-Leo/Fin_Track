import { useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Card, Empty, Field, Progress } from '../components/ui';
import { fundPlan } from '../lib/analytics';
import { dateLabel, todayISO } from '../lib/dates';
import { formatINR, round2 } from '../lib/format';
import { parseAmount, parseFund } from '../lib/validate';
import { db, useData } from '../store';
import type { SinkingFund } from '../types';

const empty = { id: '', goalName: '', targetAmount: '', currentSaved: '', targetDate: '' };

function Goal({ fund, onEdit }: { fund: SinkingFund; onEdit: () => void }) {
  const [add, setAdd] = useState('');
  const plan = fundPlan(fund, todayISO());
  const contribute = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(add);
    if (!amount) return;
    db.funds.set((l) => l.map((f) => (f.id === fund.id ? { ...f, currentSaved: Math.max(0, round2(f.currentSaved + amount)) } : f)));
    setAdd('');
  };
  return (
    <Card title={fund.goalName} action={
      <span className="flex gap-2">
        <Button aria-label={`Edit ${fund.goalName}`} onClick={onEdit}><Pencil size={14} /></Button>
        <Button variant="danger" aria-label={`Delete ${fund.goalName}`} onClick={() => { if (window.confirm(`Delete goal ${fund.goalName}?`)) db.funds.set((l) => l.filter((f) => f.id !== fund.id)); }}><Trash2 size={14} /></Button>
      </span>}>
      <p className="mb-2 text-sm tabular-nums">{formatINR(fund.currentSaved)} of {formatINR(fund.targetAmount)} ({Math.round(plan.progress)}%)</p>
      <Progress label={fund.goalName} percent={plan.progress} />
      <p className={`mt-2 text-xs ${plan.overdue ? 'text-danger' : 'text-muted'}`}>
        {!plan.remaining ? 'Goal reached' : plan.overdue ? `Past target date · ${formatINR(plan.remaining)} short`
          : `Save ${formatINR(plan.perMonth)}/month until ${dateLabel(fund.targetDate)}`}
      </p>
      <form onSubmit={contribute} className="mt-3 flex gap-2">
        <input className="field" type="number" step="0.01" aria-label={`Contribution to ${fund.goalName}`} placeholder="Add (negative to withdraw)" value={add} onChange={(e) => setAdd(e.target.value)} />
        <Button type="submit">Update</Button>
      </form>
    </Card>
  );
}

export default function Goals() {
  const { funds } = useData();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = parseFund(form);
    if (!result.ok) return setError(result.error);
    db.funds.set((l) => (form.id ? l.map((f) => (f.id === form.id ? result.value : f)) : [...l, result.value]));
    setForm(empty); setError('');
  };
  const input = (key: keyof typeof empty, label: string, type: string, required = true) => (
    <Field label={label}><input className="field" type={type} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? '0' : undefined} required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Field>
  );
  return (
    <div className="space-y-4">
      <Card title={form.id ? 'Edit goal' : 'New sinking fund'}>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {input('goalName', 'Goal name', 'text')}
          {input('targetAmount', 'Target (₹)', 'number')}
          {input('currentSaved', 'Already saved (₹)', 'number', false)}
          {input('targetDate', 'Target date', 'date')}
          <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-4">
            {error && <span role="alert" className="text-sm text-danger">{error}</span>}
            {form.id && <Button onClick={() => setForm(empty)}>Cancel</Button>}
            <Button type="submit" variant="primary">{form.id ? 'Save changes' : 'Create goal'}</Button>
          </div>
        </form>
      </Card>
      {!funds.length ? <Card><Empty>No goals yet.</Empty></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {funds.map((f) => <Goal key={f.id} fund={f} onEdit={() => setForm({ ...f, targetAmount: String(f.targetAmount), currentSaved: String(f.currentSaved) })} />)}
        </div>
      )}
    </div>
  );
}
