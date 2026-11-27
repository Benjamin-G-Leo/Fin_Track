import * as XLSX from 'xlsx';
import type { AppData, TransactionDraft } from '../types';
import { byNature, monthSummary } from './analytics';
import { monthKey } from './dates';
import { round2 } from './format';
import { parseBill, parseBudget, parseFund, parseRule, parseTransaction, text, type Parsed, type Row } from './validate';

/** Column headers are exactly the schema field names, so the UI and Excel stay aligned. */
export const SHEETS = {
  Transactions: ['id', 'date', 'type', 'amount', 'category', 'subCategory', 'spendingNature', 'account', 'merchant', 'isReimbursable'],
  Budgets: ['category', 'monthlyLimit'],
  RecurringBills: ['id', 'name', 'amount', 'frequency', 'nextDueDate', 'category', 'account'],
  SinkingFunds: ['id', 'goalName', 'targetAmount', 'currentSaved', 'targetDate'],
  KeywordRules: ['keyword', 'category', 'subCategory', 'spendingNature'],
} as const;
type SheetName = keyof typeof SHEETS;

/** Tab titles as written; earlier exports used the keys themselves, which import still accepts. */
const TITLES: Record<SheetName, string> = {
  Transactions: 'Transactions', Budgets: 'Budgets', RecurringBills: 'Recurring Bills',
  SinkingFunds: 'Savings Goals', KeywordRules: 'Keyword Rules',
};
const SUMMARY_TITLE = 'Monthly Summary';
const SUMMARY_HEADER = ['month', 'income', 'expense', 'invested', 'net', 'needs', 'wants'];

const MONEY = new Set(['amount', 'monthlyLimit', 'targetAmount', 'currentSaved', 'income', 'expense', 'invested', 'net', 'needs', 'wants']);
const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';

/** Derived, read-only view: one row per month that has transactions. Ignored on import. */
export function summaryRows(all: AppData['transactions']) {
  return [...new Set(all.map((t) => monthKey(t.date)))].sort().reverse().map((month) => {
    const { income, expense, invested, net } = monthSummary(all, month);
    const split = byNature(all, month);
    const of = (...names: string[]) => round2(split.filter((x) => names.includes(x.name)).reduce((a, x) => a + x.value, 0));
    return { month, income, expense, invested, net, needs: of('Fixed Need', 'Variable Need'), wants: of('Want') };
  });
}

function makeSheet(header: string[], rows: readonly object[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.json_to_sheet([...rows], { header });
  header.forEach((h, c) => {
    if (!MONEY.has(h)) return;
    for (let r = 1; r <= rows.length; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      // The Indian grouping format only covers positive values; negatives use a plain format.
      if (cell) cell.z = Number(cell.v) < 0 ? '"₹"#,##0.00;-"₹"#,##0.00' : INR_FORMAT;
    }
  });
  sheet['!cols'] = header.map((h) => ({ wch: h === 'merchant' || h === 'goalName' || h === 'name' ? 28 : 18 }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  return sheet;
}

const newestFirst = (list: AppData['transactions']) => [...list].sort((a, b) => b.date.localeCompare(a.date));

/** The four report tabs; `backup` also adds Budgets and Keyword Rules so everything can be restored. */
export function buildWorkbook(data: AppData, backup = false): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  const add = (name: SheetName, rows: readonly object[]) =>
    XLSX.utils.book_append_sheet(book, makeSheet([...SHEETS[name]], rows), TITLES[name]);
  add('Transactions', newestFirst(data.transactions));
  XLSX.utils.book_append_sheet(book, makeSheet(SUMMARY_HEADER, summaryRows(data.transactions)), SUMMARY_TITLE);
  add('RecurringBills', data.bills);
  add('SinkingFunds', data.funds);
  if (backup) {
    add('Budgets', data.budgets);
    add('KeywordRules', data.rules);
  }
  return book;
}

export const exportExcel = (data: AppData, filename: string, backup = false) =>
  XLSX.writeFile(buildWorkbook(data, backup), filename, { compression: true });

/** Text cells starting like a formula are quoted so a spreadsheet will not execute them. */
export function transactionsCsv(data: AppData): string {
  const safe = newestFirst(data.transactions).map((t) => Object.fromEntries(
    Object.entries(t).map(([k, v]) => [k, typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v])));
  return XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(safe, { header: [...SHEETS.Transactions] }));
}

export function exportCsv(data: AppData, filename: string) {
  // The BOM makes Excel read the file as UTF-8.
  const url = URL.createObjectURL(new Blob(['\uFEFF', transactionsCsv(data)], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

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
  const unquote = (v: unknown) => (typeof v === 'string' ? v.replace(/^'(?=[=+\-@])/, '') : v);
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [lookup.get(canon(k)) ?? k, unquote(v)]));
}

const same = (a: string, b: string) => a.replace(/\s/g, '').toLowerCase() === b.replace(/\s/g, '').toLowerCase();
const isKnown = (sheet: string) => same(sheet, SUMMARY_TITLE)
  || (Object.keys(SHEETS) as SheetName[]).some((n) => same(sheet, n) || same(sheet, TITLES[n]));

export function readWorkbook(book: XLSX.WorkBook): ImportResult {
  const errors: string[] = [];
  const present = new Set<SheetName>();
  const read = <T>(name: SheetName, parse: (r: Row) => Parsed<T>): T[] => {
    // A single unrecognised sheet (e.g. a CSV) is treated as a transaction list.
    const known = book.SheetNames.some((s) => isKnown(s));
    const actual = book.SheetNames.find((s) => same(s, name) || same(s, TITLES[name]))
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

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 50_000;
/** A refusal whose message is safe and useful to show as is. */
export class FileLimit extends Error {}

function checkRows(book: XLSX.WorkBook): XLSX.WorkBook {
  // A truncated workbook keeps its real range in "!fullref"; a truncated CSV only has "!ref".
  if (Object.values(book.Sheets).some((s) => XLSX.utils.decode_range(s['!fullref'] ?? s['!ref'] ?? 'A1').e.r > MAX_ROWS)) {
    throw new FileLimit(`That file has more than ${MAX_ROWS.toLocaleString('en-IN')} rows. Split it and import in parts.`);
  }
  return book;
}

/** Files are untrusted: size and row count are bounded before they can freeze the page. */
export async function readFile(file: File): Promise<XLSX.WorkBook> {
  if (file.size > MAX_BYTES) throw new FileLimit('That file is larger than 10 MB.');
  const sheetRows = MAX_ROWS + 2; // header, the limit, and one row to reveal an excess
  const isCsv = /\.csv$/i.test(file.name);
  // raw: true keeps CSV text as-is, so DD/MM dates are not reinterpreted as MM/DD.
  return checkRows(isCsv
    ? XLSX.read(await file.text(), { type: 'string', raw: true, sheetRows })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows }));
}

export const importExcel = async (file: File): Promise<ImportResult> => readWorkbook(await readFile(file));

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
