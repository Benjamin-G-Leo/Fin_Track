import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, Empty, Field, Select } from '../components/ui';
import { DEFAULT_RULES, matchRule } from '../lib/rules';
import { oneOf, parseRule } from '../lib/validate';
import { db, useData } from '../store';
import { CATEGORIES, SPENDING_NATURES } from '../types';

export default function Rules() {
  const { rules, transactions } = useData();
  const [form, setForm] = useState({ keyword: '', category: 'Food & Dining', subCategory: '', spendingNature: 'Want' });
  const [message, setMessage] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = parseRule(form);
    if (!result.ok) return setMessage(result.error);
    db.rules.set((l) => [result.value, ...l.filter((r) => r.keyword !== result.value.keyword)]);
    setForm({ ...form, keyword: '', subCategory: '' }); setMessage('Rule saved.');
  };

  // Only uncategorised ("Other") expenses are touched, so manual choices are never overwritten.
  const applyToOther = () => {
    let changed = 0;
    const next = transactions.map((t) => {
      if (t.category !== 'Other' || t.type !== 'Expense') return t;
      const rule = matchRule(t.merchant, rules);
      const category = oneOf(rule?.category, CATEGORIES);
      if (!rule || !category || category === 'Other') return t;
      changed++;
      return { ...t, category, subCategory: rule.subCategory, spendingNature: rule.spendingNature };
    });
    if (changed) db.transactions.set(next);
    setMessage(`Re-categorised ${changed} transaction${changed === 1 ? '' : 's'}.`);
  };

  return (
    <div className="space-y-4">
      <Card title="Add keyword rule">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Keyword"><input className="field" required value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} /></Field>
          <Field label="Category"><Select value={form.category} options={CATEGORIES} onChange={(category) => setForm({ ...form, category })} /></Field>
          <Field label="Sub-category"><input className="field" value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} /></Field>
          <Field label="Spending nature"><Select value={form.spendingNature} options={SPENDING_NATURES} onChange={(spendingNature) => setForm({ ...form, spendingNature })} /></Field>
          <div className="flex items-end"><Button type="submit" variant="primary" className="w-full">Save rule</Button></div>
        </form>
        {message && <p role="status" className="mt-2 text-sm">{message}</p>}
      </Card>
      <Card title={`Rules (${rules.length})`} action={
        <span className="flex flex-wrap justify-end gap-2">
          <Button onClick={applyToOther}>Apply to “Other”</Button>
          <Button onClick={() => { db.rules.set((l) => [...l, ...DEFAULT_RULES.filter((d) => !l.some((r) => r.keyword === d.keyword))]); setMessage('Missing default rules restored.'); }}>Restore defaults</Button>
        </span>}>
        {!rules.length ? <Empty>No rules.</Empty> : (
          <ul className="grid gap-x-6 md:grid-cols-2">
            {rules.map((r) => (
              <li key={r.keyword} className="flex items-center justify-between gap-2 border-b border-line py-2 text-sm">
                <span><strong>{r.keyword}</strong><span className="block text-xs text-muted">{r.category}{r.subCategory && ` / ${r.subCategory}`} · {r.spendingNature}</span></span>
                <Button variant="danger" aria-label={`Delete rule ${r.keyword}`} onClick={() => db.rules.set((l) => l.filter((x) => x.keyword !== r.keyword))}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
