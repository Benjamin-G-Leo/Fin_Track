import { todayISO } from './lib/dates';
import { DEFAULT_MODEL, isFreeModel } from './lib/openrouter';
import { DEFAULT_RULES } from './lib/rules';
import type { Preset } from './lib/statement';
import { addSample, removeSample, type SampleManifest } from './lib/sample';
import { PREFIX, Salvaged, stored, useStored } from './lib/storage';
import { parseBill, parseBudget, parseFund, parseRule, parseTransaction, type Parsed, type Row } from './lib/validate';
import { DEFAULT_ACCOUNTS, type AppData, type Budget, type KeywordRule, type RecurringBill, type SinkingFund, type Transaction } from './types';

/** Revives a stored list, keeping every valid row if some are not. */
export function list<T>(parse: (r: Row) => Parsed<unknown>) {
  return (raw: unknown): T[] => {
    if (!Array.isArray(raw)) throw new Error('invalid data');
    const valid = raw.filter((r) => r && parse(r as Row).ok) as T[];
    if (valid.length < raw.length) throw new Salvaged(valid, raw.length - valid.length);
    return valid;
  };
}

export const db = {
  transactions: stored<Transaction[]>('transactions', [], list(parseTransaction)),
  budgets: stored<Budget[]>('budgets', [], list(parseBudget)),
  bills: stored<RecurringBill[]>('bills', [], list(parseBill)),
  funds: stored<SinkingFund[]>('funds', [], list(parseFund)),
  rules: stored<KeywordRule[]>('rules', DEFAULT_RULES, list(parseRule)),
};

export const sampleManifest = stored<SampleManifest | null>('sample', null, (raw) => {
  const m = raw as SampleManifest | null;
  if (m && ![m.transactions, m.budgets, m.bills, m.funds].every(Array.isArray)) throw new Error('invalid data');
  return m;
});

/** 0 means "not set": Safe-to-Spend then assumes 20% of income. */
export const savingsTarget = stored<number>('savingsTarget', 0, (raw) => (typeof raw === 'number' && raw >= 0 ? raw : 0));

const snapshot = (): AppData => ({
  transactions: db.transactions.get(), budgets: db.budgets.get(), bills: db.bills.get(),
  funds: db.funds.get(), rules: db.rules.get(),
});

export function commit(next: AppData) {
  db.transactions.set(next.transactions); db.budgets.set(next.budgets); db.bills.set(next.bills);
  db.funds.set(next.funds); db.rules.set(next.rules);
}

export function clearSample() {
  const manifest = sampleManifest.get();
  if (manifest) commit(removeSample(snapshot(), manifest));
  sampleManifest.set(null);
}

/** Replaces any earlier sample with a fresh one dated this month. */
export function loadSample() {
  clearSample();
  const { next, manifest } = addSample(snapshot(), todayISO());
  commit(next);
  sampleManifest.set(manifest);
}

/** First launch only: any existing app key (even an emptied list) means "do not seed". */
export function seedOnFirstRun() {
  try {
    const used = ['transactions', 'budgets', 'bills', 'funds', 'sample'].some((k) => localStorage.getItem(PREFIX + k) !== null);
    if (!used) loadSample();
  } catch { /* storage blocked: start empty */ }
}

export const importPresets = stored<Preset[]>('importPresets', [], (raw) => {
  if (!Array.isArray(raw) || raw.some((p) => !p?.name || !p.columns)) throw new Error('invalid data');
  return raw as Preset[];
});

/** Intended day of month per bill, so a 31st does not stay on the 28th after February. */
export const billDays = stored<Record<string, number>>('billDays', {}, (raw) => {
  if (!raw || typeof raw !== 'object') throw new Error('invalid data');
  return raw as Record<string, number>;
});

export interface AiSettings { apiKey: string; model: string; denyDataCollection?: boolean; privateWords?: string }
export const aiSettings = stored<AiSettings>('openrouter', { apiKey: '', model: DEFAULT_MODEL }, (raw) => {
  const r = raw as Partial<AiSettings>;
  return {
    apiKey: String(r.apiKey ?? ''), // A paid model saved by an earlier version is replaced.
    model: isFreeModel(String(r.model)) ? String(r.model) : DEFAULT_MODEL,
    denyDataCollection: r.denyDataCollection !== false, privateWords: String(r.privateWords ?? ''),
  };
});

/** Removes the key, including any backup copy made of unreadable settings. */
export function clearAiKey() {
  aiSettings.set((s) => ({ ...s, apiKey: '' }));
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(`${PREFIX}openrouter_corrupt_`)).forEach((k) => localStorage.removeItem(k));
  } catch { /* storage blocked: nothing was saved */ }
}

export const useData = (): AppData => ({
  transactions: useStored(db.transactions),
  budgets: useStored(db.budgets),
  bills: useStored(db.bills),
  funds: useStored(db.funds),
  rules: useStored(db.rules),
});

export const knownAccounts = (data: AppData): string[] =>
  [...new Set([...DEFAULT_ACCOUNTS, ...data.transactions.map((t) => t.account), ...data.bills.map((b) => b.account)])];
