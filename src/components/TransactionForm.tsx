import { useState, type FormEvent } from 'react';
import { todayISO } from '../lib/dates';
import { baseId, countMatches, uniqueId } from '../lib/ids';
import { matchRule } from '../lib/rules';
import { defaultNature, oneOf, parseTransaction } from '../lib/validate';
import { db, knownAccounts, useData } from '../store';
import { CATEGORIES, SPENDING_NATURES, TRANSACTION_TYPES, type Transaction, type TransactionDraft } from '../types';
import { Button, Field, Select } from './ui';

const blank = (): TransactionDraft => ({
  date: todayISO(), type: 'Expense', amount: 0, category: 'Other', subCategory: '',
  spendingNature: 'Want', account: 'Cash', merchant: '', isReimbursable: false,
});

/** Saves a draft; returns false if the user declines to add a suspected duplicate. */
export function saveTransaction(draft: TransactionDraft, editingId?: string): boolean {
  const others = db.transactions.get().filter((t) => t.id !== editingId);
  const original = db.transactions.get().find((t) => t.id === editingId);
  const sameKey = original && baseId(original) === baseId(draft);
  if (!sameKey && countMatches(others, baseId(draft)) > 0 &&
      !window.confirm('A transaction with the same date, amount and merchant already exists. Save it anyway?')) return false;
  const saved: Transaction = { ...draft, id: sameKey ? original.id : uniqueId(draft, others) };
  db.transactions.set(editingId ? db.transactions.get().map((t) => (t.id === editingId ? saved : t)) : [...others, saved]);
  return true;
}

export default function TransactionForm({ initial, editingId, onDone }: {
  initial?: TransactionDraft; editingId?: string; onDone: () => void;
}) {
  const data = useData();
  const [draft, setDraft] = useState<TransactionDraft>(initial ?? blank);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [error, setError] = useState('');
  const patch = (p: Partial<TransactionDraft>) => setDraft((d) => ({ ...d, ...p }));

  const onMerchant = (merchant: string) => {
    const rule = editingId ? null : matchRule(merchant, data.rules);
    const category = oneOf(rule?.category, CATEGORIES);
    patch(rule && category ? { merchant, category, subCategory: rule.subCategory, spendingNature: rule.spendingNature } : { merchant });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = parseTransaction({ ...draft, amount });
    if (!result.ok) return setError(result.error);
    if (saveTransaction(result.value, editingId)) onDone();
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Date"><input className="field" type="date" required value={draft.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
      <Field label="Type">
        <Select value={draft.type} options={TRANSACTION_TYPES} onChange={(v) => {
          const type = v as TransactionDraft['type'];
          patch({ type, spendingNature: defaultNature(type, draft.category) });
        }} />
      </Field>
      <Field label="Amount (₹)"><input className="field" type="number" inputMode="decimal" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Merchant"><input className="field" required value={draft.merchant} onChange={(e) => onMerchant(e.target.value)} /></Field>
      <Field label="Category">
        <Select value={draft.category} options={CATEGORIES} onChange={(v) => {
          const category = v as TransactionDraft['category'];
          patch({ category, spendingNature: defaultNature(draft.type, category) });
        }} />
      </Field>
      <Field label="Sub-category"><input className="field" value={draft.subCategory} onChange={(e) => patch({ subCategory: e.target.value })} /></Field>
      <Field label="Spending nature"><Select value={draft.spendingNature} options={SPENDING_NATURES} onChange={(v) => patch({ spendingNature: v as TransactionDraft['spendingNature'] })} /></Field>
      <Field label="Account">
        <input className="field" list="accounts" required value={draft.account} onChange={(e) => patch({ account: e.target.value })} />
        <datalist id="accounts">{knownAccounts(data).map((a) => <option key={a} value={a} />)}</datalist>
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={draft.isReimbursable} onChange={(e) => patch({ isReimbursable: e.target.checked })} />
        Reimbursable (someone owes me this)
      </label>
      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        {error && <span role="alert" className="text-sm text-danger">{error}</span>}
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">{editingId ? 'Save changes' : 'Add transaction'}</Button>
      </div>
    </form>
  );
}
