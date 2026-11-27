import {
  CATEGORIES, FREQUENCIES, SPENDING_NATURES, TRANSACTION_TYPES,
  type Budget, type Category, type KeywordRule, type RecurringBill, type SinkingFund,
  type SpendingNature, type TransactionDraft, type TransactionType,
} from '../types';
import { makeISO } from './dates';
import { round2 } from './format';
import { randomId } from './ids';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export type Row = Record<string, unknown>;

export const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

export function oneOf<T extends string>(v: unknown, options: readonly T[]): T | null {
  const s = text(v).toLowerCase();
  return options.find((o) => o.toLowerCase() === s) ?? null;
}

export function parseAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : null;
  const s = text(v).replace(/₹|rs\.?|inr|,|\s/gi, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? round2(Number(s)) : null;
}

/** Accepts Excel serial numbers, YYYY-MM-DD and Indian DD/MM/YYYY or DD-MM-YYYY. */
export function parseDate(v: unknown): string | null {
  if (typeof v === 'number') {
    if (v < 1 || v > 100000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000);
    return makeISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = text(v);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return makeISO(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) return makeISO(Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[ /-]([A-Za-z]{3,9})[ ,/-]+(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1;
    return month ? makeISO(Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]), month, Number(m[1])) : null;
  }
  return null;
}

export const parseBool = (v: unknown): boolean => v === true || /^(true|yes|y|1)$/i.test(text(v));

export function defaultNature(type: TransactionType, category: Category): SpendingNature {
  if (type === 'Investment' || type === 'Income' || type === 'Transfer') return 'Savings';
  if (category === 'Rent & Housing' || category === 'Utilities & Bills') return 'Fixed Need';
  if (category === 'Food & Dining' || category === 'Transport' || category === 'Health') return 'Variable Need';
  return 'Want';
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export function parseTransaction(r: Row): Parsed<TransactionDraft> {
  const date = parseDate(r.date);
  if (!date) return fail('invalid date');
  const amount = parseAmount(r.amount);
  if (amount === null || amount === 0) return fail('invalid amount');
  const type = text(r.type) ? oneOf(r.type, TRANSACTION_TYPES) : 'Expense';
  if (!type) return fail(`unknown type "${text(r.type)}"`);
  const category = text(r.category) ? oneOf(r.category, CATEGORIES) : 'Other';
  if (!category) return fail(`unknown category "${text(r.category)}"`);
  const merchant = text(r.merchant);
  if (!merchant) return fail('merchant is empty');
  return {
    ok: true,
    value: {
      date, type, category, merchant, amount: Math.abs(amount),
      subCategory: text(r.subCategory),
      spendingNature: oneOf(r.spendingNature, SPENDING_NATURES) ?? defaultNature(type, category),
      account: text(r.account) || 'Cash',
      isReimbursable: parseBool(r.isReimbursable),
    },
  };
}

export function parseBudget(r: Row): Parsed<Budget> {
  const category = oneOf(r.category, CATEGORIES);
  const monthlyLimit = parseAmount(r.monthlyLimit);
  if (!category) return fail('unknown category');
  if (monthlyLimit === null || monthlyLimit <= 0) return fail('monthlyLimit must be above 0');
  return { ok: true, value: { category, monthlyLimit } };
}

export function parseBill(r: Row): Parsed<RecurringBill> {
  const name = text(r.name), amount = parseAmount(r.amount), nextDueDate = parseDate(r.nextDueDate);
  const frequency = oneOf(r.frequency, FREQUENCIES);
  if (!name) return fail('name is empty');
  if (amount === null || amount <= 0) return fail('invalid amount');
  if (!frequency) return fail('frequency must be Monthly, Quarterly or Yearly');
  if (!nextDueDate) return fail('invalid nextDueDate');
  return {
    ok: true,
    value: {
      id: text(r.id) || randomId('bill'), name, amount, frequency, nextDueDate,
      category: oneOf(r.category, CATEGORIES) ?? 'Other', account: text(r.account) || 'Cash',
    },
  };
}

export function parseFund(r: Row): Parsed<SinkingFund> {
  const goalName = text(r.goalName), targetAmount = parseAmount(r.targetAmount);
  const currentSaved = text(r.currentSaved) ? parseAmount(r.currentSaved) : 0;
  const targetDate = parseDate(r.targetDate);
  if (!goalName) return fail('goalName is empty');
  if (targetAmount === null || targetAmount <= 0) return fail('targetAmount must be above 0');
  if (currentSaved === null || currentSaved < 0) return fail('invalid currentSaved');
  if (!targetDate) return fail('invalid targetDate');
  return { ok: true, value: { id: text(r.id) || randomId('fund'), goalName, targetAmount, currentSaved, targetDate } };
}

export function parseRule(r: Row): Parsed<KeywordRule> {
  const keyword = text(r.keyword).toLowerCase();
  const category = oneOf(r.category, CATEGORIES);
  const spendingNature = oneOf(r.spendingNature, SPENDING_NATURES);
  if (!keyword) return fail('keyword is empty');
  if (!category) return fail('unknown category');
  if (!spendingNature) return fail('unknown spendingNature');
  return { ok: true, value: { keyword, category, subCategory: text(r.subCategory), spendingNature } };
}
