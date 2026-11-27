import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { AppData, TransactionDraft } from '../types';
import { budgetSplit, cumulativeSpend, fundPlan, monthSummary, owedToMe, safeToSpend } from './analytics';
import { addSample, removeSample, sampleData } from './sample';
import { addMonths } from './dates';
import { applyImport, buildWorkbook, readWorkbook } from './excel';
import { formatINR } from './format';
import { baseId, mergeTransactions } from './ids';
import { parseQuickAdd } from './quickAdd';
import { DEFAULT_RULES } from './rules';
import { parseDate } from './validate';

const accounts = ['HDFC UPI', 'ICICI Credit Card', 'SBI Savings', 'Cash'];
const quick = (s: string) => parseQuickAdd(s, DEFAULT_RULES, accounts, '2026-11-27');
const draft: TransactionDraft = {
  date: '2026-11-02', type: 'Expense', amount: 450, category: 'Food & Dining', subCategory: 'Delivery',
  spendingNature: 'Want', account: 'HDFC UPI', merchant: 'Swiggy', isReimbursable: false,
};

describe('format and dates', () => {
  it('uses Indian grouping', () => expect(formatINR(125000)).toBe('₹1,25,000.00'));
  it('clamps month ends', () => expect(addMonths('2027-01-31', 1)).toBe('2027-02-28'));
  it('reads dates as day-first and rejects impossible ones', () => {
    expect(parseDate('03/04/2026')).toBe('2026-04-03');
    expect(parseDate(46023)).toBe('2026-01-01');
    expect(parseDate('31/02/2026')).toBeNull();
  });
});

describe('quick add', () => {
  it('parses merchant, account and relative date', () => {
    expect(quick('450 swiggy hdfc upi yesterday')).toMatchObject({
      amount: 450, merchant: 'Swiggy', account: 'HDFC UPI', date: '2026-11-26', category: 'Food & Dining', type: 'Expense',
    });
  });
  it('understands lakh suffixes and income', () => {
    expect(quick('salary 1.25L sbi 1/11')).toMatchObject({ amount: 125000, type: 'Income', account: 'SBI Savings', date: '2026-11-01' });
  });
  it('handles currency marks, reimbursable flag and investments', () => {
    expect(quick('₹1,200 team lunch cash #r')).toMatchObject({ amount: 1200, isReimbursable: true, merchant: 'Team lunch' });
    expect(quick('sip 5000')).toMatchObject({ type: 'Investment', category: 'Investments' });
  });
  it('does not read a spaced litre unit as lakh', () => {
    expect(quick('1 l milk 60')?.amount).toBe(60);
    expect(quick('bonus 2 lakh')?.amount).toBe(200000);
  });
  it('treats an upcoming day-month as last year and needs an amount', () => {
    expect(quick('300 uber 25 dec')?.date).toBe('2025-12-25');
    expect(quick('uber')).toBeNull();
  });
});

describe('ids and totals', () => {
  it('ignores merchant case and punctuation', () =>
    expect(baseId(draft)).toBe(baseId({ ...draft, merchant: ' SWIGGY. ' })));
  it('keeps real repeats and is idempotent on re-import', () => {
    const first = mergeTransactions([], [draft, draft]);
    expect(first.added).toBe(2);
    expect(new Set(first.transactions.map((t) => t.id)).size).toBe(2);
    expect(mergeTransactions(first.transactions, [draft, draft])).toMatchObject({ added: 0, skipped: 2 });
  });
  it('excludes reimbursables and nets repayments', () => {
    const reimb = { ...draft, amount: 1000, isReimbursable: true };
    const { transactions } = mergeTransactions([], [draft, reimb, { ...reimb, type: 'Income', amount: 400 }]);
    expect(monthSummary(transactions, '2026-11')).toMatchObject({ expense: 450, income: 0 });
    expect(owedToMe(transactions).total).toBe(600);
  });
  it('plans monthly saving', () =>
    expect(fundPlan({ id: 'f', goalName: 'g', targetAmount: 12000, currentSaved: 0, targetDate: '2027-05-01' }, '2026-11-27').perMonth).toBe(2000));
});

describe('excel', () => {
  const data: AppData = {
    transactions: mergeTransactions([], [draft]).transactions,
    budgets: [{ category: 'Shopping', monthlyLimit: 5000 }],
    bills: [{ id: 'b1', name: 'Rent', amount: 25000, frequency: 'Monthly', nextDueDate: '2026-12-01', category: 'Rent & Housing', account: 'SBI Savings' }],
    funds: [{ id: 'f1', goalName: 'Trip', targetAmount: 60000, currentSaved: 100, targetDate: '2027-06-01' }],
    rules: [{ keyword: 'swiggy', category: 'Food & Dining', subCategory: '', spendingNature: 'Want' }],
  };
  it('round-trips every record through a real xlsx file', () => {
    const bytes = XLSX.write(buildWorkbook(data), { type: 'array', bookType: 'xlsx' });
    const file = readWorkbook(XLSX.read(bytes, { type: 'array' }));
    expect(file.errors).toEqual([]);
    const empty: AppData = { transactions: [], budgets: [], bills: [], funds: [], rules: [] };
    expect(applyImport(empty, file, 'replace', mergeTransactions).next).toEqual(data);
  });
  it('reads CSV day-first and reports bad rows without wiping other data', () => {
    const csv = 'Date,Amount,Merchant\n03/04/2026,100,Cafe\nbad,5,X\n';
    const file = readWorkbook(XLSX.read(csv, { type: 'string', raw: true }));
    expect(file.transactions[0]).toMatchObject({ date: '2026-04-03', amount: 100 });
    expect(file.errors).toEqual(['Transactions row 3: invalid date']);
    expect(applyImport(data, file, 'replace', mergeTransactions).next.budgets).toEqual(data.budgets);
  });
});

describe('spec examples', () => {
  it('parses the two quick-add examples', () => {
    expect(quick('450 lunch swiggy UPI')).toMatchObject({ amount: 450, category: 'Food & Dining', account: 'HDFC UPI', merchant: 'Lunch swiggy' });
    expect(quick('2500 electricity bill')).toMatchObject({ amount: 2500, category: 'Utilities & Bills', spendingNature: 'Fixed Need' });
  });
});

describe('dashboard maths', () => {
  const tx = (type: TransactionDraft['type'], amount: number, extra: Partial<TransactionDraft> = {}) =>
    ({ ...draft, type, amount, merchant: `${type}${amount}`, ...extra });
  const { transactions } = mergeTransactions([], [tx('Income', 100000), tx('Expense', 10000), tx('Investment', 5000)]);
  const bill = { id: 'b', name: 'Rent', amount: 20000, frequency: 'Monthly' as const, nextDueDate: '2026-11-29', category: 'Rent & Housing', account: 'Cash' };

  it('computes safe-to-spend with a default 20% target', () => {
    // (100000 − 20000 − 20000 − 10000) / 4 days (27th–30th)
    expect(safeToSpend(transactions, [bill, { ...bill, id: 'next', nextDueDate: '2026-12-01' }], 0, '2026-11-27'))
      .toMatchObject({ fixedBills: 20000, savings: 20000, daysLeft: 4, daily: 12500 });
  });
  it('never shows a negative allowance', () =>
    expect(safeToSpend(transactions, [bill], 90000, '2026-11-30')).toMatchObject({ remaining: -20000, daily: 0 }));
  it('splits income and accumulates spend', () => {
    expect(budgetSplit(transactions, '2026-11').rows.map((r) => r.percent)).toEqual([0, 10, 5]);
    expect(cumulativeSpend(transactions, '2026-11', '2026-11-03').map((d) => d.total)).toEqual([0, 10000, 10000]);
  });
});

describe('sample data', () => {
  const empty: AppData = { transactions: [], budgets: [], bills: [], funds: [], rules: [] };
  it('has 15 unique transactions in the current month, even on the 1st', () => {
    const s = sampleData('2026-11-01');
    expect(s.transactions).toHaveLength(15);
    expect(new Set(s.transactions.map((t) => t.id)).size).toBe(15);
    expect(s.transactions.every((t) => t.date === '2026-11-01')).toBe(true);
  });
  it('clears only what it added', () => {
    const mine: AppData = { ...empty, transactions: mergeTransactions([], [draft]).transactions, budgets: [{ category: 'Shopping', monthlyLimit: 1 }] };
    const { next, manifest } = addSample(mine, '2026-11-27');
    expect(removeSample(next, manifest)).toEqual(mine);
  });
});
