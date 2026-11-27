import { CATEGORIES, SPENDING_NATURES, type SinkingFund, type Transaction } from '../types';
import { monthKey, shiftMonth } from './dates';
import { round2 } from './format';
import { normalizeMerchant } from './ids';

const sum = (list: Transaction[]) => round2(list.reduce((a, t) => a + t.amount, 0));
/** Personal expenses: reimbursable amounts are never counted. */
export const personalExpenses = (list: Transaction[]) => list.filter((t) => t.type === 'Expense' && !t.isReimbursable);

export function monthSummary(all: Transaction[], month: string) {
  const list = all.filter((t) => monthKey(t.date) === month);
  const income = sum(list.filter((t) => t.type === 'Income' && !t.isReimbursable));
  const expense = sum(personalExpenses(list));
  const invested = sum(list.filter((t) => t.type === 'Investment'));
  return { income, expense, invested, net: round2(income - expense - invested) };
}

export const trend = (all: Transaction[], endMonth: string, count = 6) =>
  Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(endMonth, i - count + 1);
    return { month, ...monthSummary(all, month) };
  });

function breakdown<K extends keyof Transaction>(all: Transaction[], month: string, key: K, values: readonly string[]) {
  const list = personalExpenses(all).filter((t) => monthKey(t.date) === month);
  return values.map((name) => ({ name, value: sum(list.filter((t) => t[key] === name)) })).filter((x) => x.value > 0);
}
export const byCategory = (all: Transaction[], month: string) =>
  breakdown(all, month, 'category', CATEGORIES).sort((a, b) => b.value - a.value);
export const byNature = (all: Transaction[], month: string) => breakdown(all, month, 'spendingNature', SPENDING_NATURES);

/**
 * "Owed to Me": reimbursable expenses minus reimbursable income (repayments), per merchant.
 */
export function owedToMe(all: Transaction[]) {
  const map = new Map<string, { merchant: string; amount: number; account: string }>();
  for (const t of [...all].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!t.isReimbursable || (t.type !== 'Expense' && t.type !== 'Income')) continue;
    const key = normalizeMerchant(t.merchant);
    const row = map.get(key) ?? { merchant: t.merchant, amount: 0, account: t.account };
    row.amount = round2(row.amount + (t.type === 'Expense' ? t.amount : -t.amount));
    row.account = t.account;
    map.set(key, row);
  }
  const rows = [...map.values()].filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  return { rows, total: round2(rows.reduce((a, r) => a + r.amount, 0)) };
}

export function fundPlan(fund: SinkingFund, today: string) {
  const remaining = Math.max(0, round2(fund.targetAmount - fund.currentSaved));
  const [ty, tm] = fund.targetDate.split('-').map(Number) as [number, number];
  const [y, m] = today.split('-').map(Number) as [number, number];
  const monthsLeft = Math.max(1, (ty - y) * 12 + (tm - m));
  return {
    remaining,
    perMonth: round2(remaining / monthsLeft),
    monthsLeft,
    overdue: remaining > 0 && fund.targetDate < today,
    progress: Math.min(100, (fund.currentSaved / fund.targetAmount) * 100),
  };
}
