import * as XLSX from 'xlsx';
import type { AppData, TransactionDraft } from '../types';
import { parseBill, parseBudget, parseFund, parseRule, parseTransaction, text, type Parsed, type Row } from './validate';

/** Sheet names and column headers are exactly the schema field names, so the UI and Excel stay aligned. */
export const SHEETS = {
  Transactions: ['id', 'date', 'type', 'amount', 'category', 'subCategory', 'spendingNature', 'account', 'merchant', 'isReimbursable'],
  Budgets: ['category', 'monthlyLimit'],
  RecurringBills: ['id', 'name', 'amount', 'frequency', 'nextDueDate', 'category', 'account'],
  SinkingFunds: ['id', 'goalName', 'targetAmount', 'currentSaved', 'targetDate'],
  KeywordRules: ['keyword', 'category', 'subCategory', 'spendingNature'],
} as const;
type SheetName = keyof typeof SHEETS;

const MONEY = new Set(['amount', 'monthlyLimit', 'targetAmount', 'currentSaved']);
const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';

export function buildWorkbook(data: AppData): XLSX.WorkBook {
  const rows: Record<SheetName, readonly object[]> = {
    Transactions: [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    Budgets: data.budgets, RecurringBills: data.bills, SinkingFunds: data.funds, KeywordRules: data.rules,
  };
  const book = XLSX.utils.book_new();
  for (const name of Object.keys(SHEETS) as SheetName[]) {
    const header = [...SHEETS[name]] as string[];
    const sheet = XLSX.utils.json_to_sheet([...rows[name]], { header });
    header.forEach((h, c) => {
      if (!MONEY.has(h)) return;
      for (let r = 1; r <= rows[name].length; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        if (cell) cell.z = INR_FORMAT;
      }
    });
    sheet['!cols'] = header.map((h) => ({ wch: h === 'merchant' || h === 'goalName' ? 28 : 18 }));
    XLSX.utils.book_append_sheet(book, sheet, name);
  }
  return book;
}

export const exportExcel = (data: AppData, filename: string) =>
  XLSX.writeFile(buildWorkbook(data), filename, { compression: true });

export interface ImportResult {
  transactions: TransactionDraft[];
  budgets: AppData['budgets'];
  bills: AppData['bills'];
  funds: AppData['funds'];
  rules: AppData['rules'];
  /** Which sheets were present, so "replace" never wipes data the file did not contain. */
  present: Set<SheetName>;
  errors: string[];
}

/** Maps headers such as "Sub Category" or "AMOUNT" onto schema field names. */
function normalizeRow(row: Row, fields: readonly string[]): Row {
  const canon = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const lookup = new Map(fields.map((f) => [canon(f), f]));
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [lookup.get(canon(k)) ?? k, v]));
}

export function readWorkbook(book: XLSX.WorkBook): ImportResult {
  const errors: string[] = [];
  const present = new Set<SheetName>();
  const read = <T>(name: SheetName, parse: (r: Row) => Parsed<T>): T[] => {
    // A single-sheet file (e.g. a CSV) is treated as a transaction list.
    const known = book.SheetNames.some((s) => s in SHEETS);
    const actual = book.SheetNames.find((s) => s.toLowerCase() === name.toLowerCase())
      ?? (name === 'Transactions' && !known && book.SheetNames.length === 1 ? book.SheetNames[0] : undefined);
    if (!actual) return [];
    present.add(name);
    const out: T[] = [];
    XLSX.utils.sheet_to_json<Row>(book.Sheets[actual]!, { defval: '', raw: true, blankrows: true }).forEach((row, i) => {
      if (Object.values(row).every((v) => !text(v))) return;
      const result = parse(normalizeRow(row, SHEETS[name]));
      if (result.ok) out.push(result.value);
      else errors.push(`${name} row ${i + 2}: ${result.error}`);
    });
    return out;
  };
  const result = {
    transactions: read('Transactions', parseTransaction),
    budgets: read('Budgets', parseBudget),
    bills: read('RecurringBills', parseBill),
    funds: read('SinkingFunds', parseFund),
    rules: read('KeywordRules', parseRule),
    present, errors,
  };
  if (!present.size) errors.push('No recognised sheets found.');
  return result;
}

export async function importExcel(file: File): Promise<ImportResult> {
  const isCsv = /\.csv$/i.test(file.name);
  // raw: true keeps CSV text as-is, so DD/MM dates are not reinterpreted as MM/DD.
  const book = isCsv
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return readWorkbook(book);
}

const keyed = <T>(current: T[], incoming: T[], key: (x: T) => string): T[] =>
  [...new Map([...current, ...incoming].map((x) => [key(x), x])).values()];

export function applyImport(
  data: AppData, file: ImportResult, mode: 'merge' | 'replace',
  merge: (existing: AppData['transactions'], incoming: TransactionDraft[]) => { transactions: AppData['transactions']; added: number; skipped: number },
) {
  const replace = mode === 'replace';
  const base = (name: SheetName) => replace && file.present.has(name);
  const tx = merge(base('Transactions') ? [] : data.transactions, file.transactions);
  const next: AppData = {
    transactions: tx.transactions,
    budgets: keyed(base('Budgets') ? [] : data.budgets, file.budgets, (b) => b.category),
    bills: keyed(base('RecurringBills') ? [] : data.bills, file.bills, (b) => b.id),
    funds: keyed(base('SinkingFunds') ? [] : data.funds, file.funds, (f) => f.id),
    rules: keyed(base('KeywordRules') ? [] : data.rules, file.rules, (r) => r.keyword),
  };
  return { next, added: tx.added, skipped: tx.skipped };
}
