import * as XLSX from 'xlsx';
import { CATEGORIES, type KeywordRule, type Transaction, type TransactionDraft } from '../types';
import { baseId, countMatches, uniqueId } from './ids';
import { matchRule } from './rules';
import { isOwnTransfer } from './transfers';
import { defaultNature, oneOf, parseAmount, parseDate, text } from './validate';

export type Grid = unknown[][];
export const FIELDS = ['date', 'narration', 'debit', 'credit', 'account'] as const;
export type Field = (typeof FIELDS)[number];

/** Columns are remembered by header text, so a preset survives reordered columns. */
export interface Preset {
  name: string;
  columns: Record<Field, string>;
  /** Used when no account column is mapped. */
  accountName: string;
}

export interface Mapping {
  headerRow: number;
  /** Column index per field; -1 means not mapped. */
  columns: Record<Field, number>;
  accountName: string;
}

const preset = (name: string, date: string, narration: string, debit: string, credit: string, accountName: string): Preset =>
  ({ name, columns: { date, narration, debit, credit, account: '' }, accountName });

export const BANK_PRESETS: Preset[] = [
  preset('HDFC', 'Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.', 'HDFC Savings'),
  preset('ICICI', 'Transaction Date', 'Transaction Remarks', 'Withdrawal Amount (INR )', 'Deposit Amount (INR )', 'ICICI Savings'),
  preset('SBI', 'Txn Date', 'Description', 'Debit', 'Credit', 'SBI Savings'),
];

const ALIASES: Record<Field, string[]> = {
  date: ['date', 'txndate', 'transactiondate', 'trandate', 'postingdate'],
  narration: ['narration', 'transactionremarks', 'description', 'particulars', 'remarks', 'merchant', 'details'],
  debit: ['withdrawalamt', 'withdrawalamountinr', 'withdrawalamount', 'withdrawal', 'debit', 'debitamount', 'dramount'],
  credit: ['depositamt', 'depositamountinr', 'depositamount', 'deposit', 'credit', 'creditamount', 'cramount'],
  account: ['account', 'accountname'],
};

const canon = (v: unknown) => text(v).toLowerCase().replace(/[^a-z]/g, '');

export const toGrid = (book: XLSX.WorkBook): Grid =>
  XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]!]!, { header: 1, raw: true, defval: '', blankrows: true });

/** Bank files start with address and account lines; pick the row that looks most like a header. */
export function findHeaderRow(grid: Grid): number {
  let best = 0, bestScore = 0;
  grid.slice(0, 60).forEach((row, i) => {
    const cells = row.map(canon);
    const score = FIELDS.filter((f) => cells.some((c) => ALIASES[f].includes(c))).length;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

/** Maps the preset's header names first, then falls back to common aliases. */
export function mapColumns(header: unknown[], from?: Preset): Record<Field, number> {
  const cells = header.map(canon);
  const find = (field: Field) => {
    const wanted = from ? canon(from.columns[field]) : '';
    const exact = wanted ? cells.indexOf(wanted) : -1;
    if (exact >= 0) return exact;
    for (const alias of ALIASES[field]) {
      const i = cells.indexOf(alias);
      if (i >= 0) return i;
    }
    return -1;
  };
  return Object.fromEntries(FIELDS.map((f) => [f, find(f)])) as Record<Field, number>;
}

/** Suggests the bank whose own column names all appear in the header. */
export const detectPreset = (header: unknown[], presets: Preset[]): Preset | undefined => {
  const cells = new Set(header.map(canon));
  return presets.find((p) => FIELDS.every((f) => !p.columns[f] || cells.has(canon(p.columns[f]))));
};

/** Pulls the payee out of UPI and card narrations; otherwise returns the narration unchanged. */
export function cleanMerchant(narration: string): string {
  const s = narration.replace(/\s+/g, ' ').trim();
  let name = /^UPI-([^-]+)-/i.exec(s)?.[1]
    ?? /UPI\/(?:DR|CR)\/\d+\/([^/]+)/i.exec(s)?.[1];
  if (!name && /^UPI\//i.test(s)) {
    const parts = s.split('/').slice(1).map((p) => p.trim());
    name = parts.find((p) => p.includes('@'))?.split('@')[0]
      ?? parts.find((p) => p && !/^(\d+|dr|cr|p2[am])$/i.test(p));
  }
  name ??= /^POS \S*\d{4} (.+)$/i.exec(s)?.[1];
  const result = (name ?? s).trim() || s;
  return result === result.toUpperCase()
    ? result.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
    : result;
}

export function classify(merchant: string, narration: string, isDebit: boolean, rules: KeywordRule[]) {
  const rule = matchRule(merchant, rules) ?? matchRule(narration, rules);
  let category = oneOf(rule?.category, CATEGORIES) ?? 'Other';
  // "Salary" on money going out, or "Investments" coming back in, would distort the totals.
  if (isDebit && category === 'Salary') category = 'Other';
  const transfer = isOwnTransfer(narration);
  if (transfer) category = 'Other';
  const type: TransactionDraft['type'] = transfer ? 'Transfer' : !isDebit ? 'Income' : category === 'Investments' ? 'Investment' : 'Expense';
  const matched = !!rule && category === rule.category;
  return {
    type, category,
    subCategory: matched ? rule.subCategory : '',
    spendingNature: matched && type === 'Expense' ? rule.spendingNature : defaultNature(type, category),
  };
}

export interface StatementRow { line: number; narration: string; draft: TransactionDraft }

export function parseStatement(grid: Grid, mapping: Mapping, rules: KeywordRule[]) {
  const rows: StatementRow[] = [];
  const skipped: string[] = [];
  const { columns } = mapping;
  grid.slice(mapping.headerRow + 1).forEach((cells, i) => {
    const line = mapping.headerRow + i + 2;
    const at = (f: Field) => (columns[f] >= 0 ? cells[columns[f]] : '');
    if (cells.every((c) => !text(c))) return;
    const date = parseDate(typeof at('date') === 'string' ? text(at('date')).replace(/ \d{1,2}:\d{2}.*$/, '') : at('date'));
    const narration = text(at('narration')).slice(0, 500);
    const debit = Math.abs(parseAmount(at('debit')) ?? 0);
    const credit = Math.abs(parseAmount(at('credit')) ?? 0);
    const reason = !date ? 'no valid date' : !narration ? 'no narration'
      : !debit && !credit ? 'no debit or credit amount' : debit && credit ? 'both debit and credit filled' : '';
    if (reason) return void skipped.push(`Row ${line}: ${reason}`);
    const merchant = cleanMerchant(narration);
    rows.push({
      line, narration,
      draft: {
        date: date!, merchant, amount: debit || credit,
        account: text(at('account')) || mapping.accountName.trim() || 'Bank',
        isReimbursable: false,
        ...classify(merchant, narration, debit > 0, rules),
      },
    });
  });
  return { rows, skipped };
}

export type Status = 'New' | 'Repeat in file' | 'Duplicate';

/**
 * A row is a duplicate while the ledger still holds an unclaimed transaction with the same hash.
 * Further identical rows are genuine repeats within the statement.
 */
export function flagDuplicates(rows: StatementRow[], existing: Transaction[]): Status[] {
  const seen = new Map<string, number>();
  return rows.map(({ draft }) => {
    const id = baseId(draft);
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n <= countMatches(existing, id) ? 'Duplicate' : n > 1 ? 'Repeat in file' : 'New';
  });
}

export function appendTransactions(existing: Transaction[], drafts: TransactionDraft[]): Transaction[] {
  const result = [...existing];
  for (const draft of drafts) result.push({ ...draft, id: uniqueId(draft, result) });
  return result;
}
