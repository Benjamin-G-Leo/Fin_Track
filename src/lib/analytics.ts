import { CATEGORIES, MONTHS_PER, SPENDING_NATURES, type Budget, type RecurringBill, type SinkingFund, type Transaction } from '../types';
import { addDays, addMonths, daysBetween, monthKey, shiftMonth } from './dates';
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

const monthEnd = (iso: string): string => addDays(addMonths(`${monthKey(iso)}-01`, 1), -1);

/**
 * (Income − unpaid bills due by month end − savings target − personal expenses) / days left,
 * for the month containing `today`; today counts as a day left.
 * Investments already made or still due count towards the target, and raise it if they exceed it.
 */
export function safeToSpend(all: Transaction[], bills: RecurringBill[], target: number, today: string) {
  const { income, expense, invested } = monthSummary(all, monthKey(today));
  const end = monthEnd(today);
  const due = bills.filter((b) => b.nextDueDate <= end);
  // A bill several periods behind is owed once for each missed date.
  const times = (b: RecurringBill) => {
    let n = 0;
    for (let d = b.nextDueDate; d <= end && n < 600; d = addMonths(b.nextDueDate, ++n * MONTHS_PER[b.frequency])) { /* count */ }
    return n;
  };
  const total = (list: RecurringBill[]) => round2(list.reduce((a, b) => a + b.amount * times(b), 0));
  const fixedBills = total(due.filter((b) => b.category !== 'Investments'));
  const baseTarget = target > 0 ? target : round2(income * 0.2);
  const savings = Math.max(baseTarget, round2(invested + total(due.filter((b) => b.category === 'Investments'))));
  const remaining = round2(income - fixedBills - savings - expense);
  const daysLeft = daysBetween(today, end) + 1;
  return { income, fixedBills, savings, expense, remaining, daysLeft, daily: Math.max(0, round2(remaining / daysLeft)) };
}

/** 50/30/20 split of the month's income. Savings = investments plus expenses marked Savings. */
export function budgetSplit(all: Transaction[], month: string) {
  const { income, invested } = monthSummary(all, month);
  const spent = byNature(all, month);
  const of = (...names: string[]) => round2(spent.filter((s) => names.includes(s.name)).reduce((a, s) => a + s.value, 0));
  const rows = [
    { name: 'Needs', amount: of('Fixed Need', 'Variable Need'), target: 50 },
    { name: 'Wants', amount: of('Want'), target: 30 },
    { name: 'Savings', amount: round2(of('Savings') + invested), target: 20 },
  ];
  return { income, rows: rows.map((r) => ({ ...r, percent: income ? (r.amount / income) * 100 : 0 })) };
}

export function categoryVsBudget(all: Transaction[], budgets: Budget[], month: string) {
  const spent = new Map(byCategory(all, month).map((c) => [c.name, c.value]));
  const limits = new Map(budgets.map((b) => [b.category, b.monthlyLimit]));
  return CATEGORIES.filter((c) => spent.has(c) || limits.has(c))
    .map((name) => ({ name, spent: spent.get(name) ?? 0, budget: limits.get(name) ?? 0 }));
}

/** Running total of personal expenses by day; stops at today for the current month. */
export function cumulativeSpend(all: Transaction[], month: string, today: string) {
  const first = `${month}-01`;
  if (month > monthKey(today)) return [];
  const last = month === monthKey(today) ? today : monthEnd(first);
  const list = personalExpenses(all).filter((t) => monthKey(t.date) === month);
  let total = 0;
  return Array.from({ length: Number(last.slice(8)) }, (_, i) => {
    const date = addDays(first, i);
    total = round2(total + sum(list.filter((t) => t.date === date)));
    return { day: i + 1, total };
  });
}
