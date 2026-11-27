import { DEFAULT_RULES } from './lib/rules';
import { stored, useStored } from './lib/storage';
import { parseBill, parseBudget, parseFund, parseRule, parseTransaction, type Parsed, type Row } from './lib/validate';
import { DEFAULT_ACCOUNTS, type AppData, type Budget, type KeywordRule, type RecurringBill, type SinkingFund, type Transaction } from './types';

/** Revives a stored list, throwing (so the raw value is backed up) if any row is invalid. */
function list<T>(parse: (r: Row) => Parsed<unknown>) {
  return (raw: unknown): T[] => {
    if (!Array.isArray(raw) || raw.some((r) => !r || !parse(r as Row).ok)) throw new Error('invalid data');
    return raw as T[];
  };
}

export const db = {
  transactions: stored<Transaction[]>('transactions', [], list(parseTransaction)),
  budgets: stored<Budget[]>('budgets', [], list(parseBudget)),
  bills: stored<RecurringBill[]>('bills', [], list(parseBill)),
  funds: stored<SinkingFund[]>('funds', [], list(parseFund)),
  rules: stored<KeywordRule[]>('rules', DEFAULT_RULES, list(parseRule)),
};

export interface AiSettings { apiKey: string; model: string }
export const aiSettings = stored<AiSettings>('openrouter', { apiKey: '', model: 'openrouter/auto' }, (raw) => {
  const r = raw as Partial<AiSettings>;
  return { apiKey: String(r.apiKey ?? ''), model: String(r.model || 'openrouter/auto') };
});

export const useData = (): AppData => ({
  transactions: useStored(db.transactions),
  budgets: useStored(db.budgets),
  bills: useStored(db.bills),
  funds: useStored(db.funds),
  rules: useStored(db.rules),
});

export const knownAccounts = (data: AppData): string[] =>
  [...new Set([...DEFAULT_ACCOUNTS, ...data.transactions.map((t) => t.account), ...data.bills.map((b) => b.account)])];
