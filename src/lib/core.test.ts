import * as XLSX from 'xlsx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData, TransactionDraft } from '../types';
import { budgetSplit, categoryVsBudget, cumulativeSpend, fundPlan, monthSummary, owedToMe, safeToSpend } from './analytics';
import { addSample, removeSample, sampleData } from './sample';
import { addMonths, nextDue } from './dates';
import { aiParse } from './openrouter';
import { list } from '../store';
import { parseTransaction } from './validate';
import { classify } from './statement';
import { applyImport, buildWorkbook, readFile, MAX_BYTES, MAX_ROWS, readWorkbook, transactionsCsv } from './excel';
import { appendTransactions, BANK_PRESETS, cleanMerchant, detectPreset, findHeaderRow, flagDuplicates, mapColumns, parseStatement, toGrid } from './statement';
import { disableLock, enableLock, forgetKey, read, unlock, write } from './vault';
import { formatINR } from './format';
import { aiBatch, aiInsights, auditPayload, isFreeModel, MODEL_CHOICES } from './openrouter';
import { redact } from './redact';
import { amountAppears, parseSms, splitMessages } from './sms';
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
    const bytes = XLSX.write(buildWorkbook(data, true), { type: 'array', bookType: 'xlsx' });
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

describe('four-tab export', () => {
  const data: AppData = { transactions: mergeTransactions([], [{ ...draft, merchant: '=HYPERLINK("x")' }]).transactions, budgets: [], bills: [], funds: [], rules: [] };
  it('writes the report tabs and reads them back without touching budgets', () => {
    const book = XLSX.read(XLSX.write(buildWorkbook(data), { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    expect(book.SheetNames).toEqual(['Transactions', 'Monthly Summary', 'Recurring Bills', 'Savings Goals']);
    const file = readWorkbook(book);
    expect(file.errors).toEqual([]);
    expect(file.transactions).toHaveLength(1);
    expect(file.present.has('Budgets')).toBe(false);
  });
  it('neutralises formulas in CSV and restores the original text', () => {
    const csv = transactionsCsv(data);
    expect(csv).toContain("'=HYPERLINK");
    expect(readWorkbook(XLSX.read(csv, { type: 'string', raw: true })).transactions[0]?.merchant).toBe('=HYPERLINK("x")');
  });
});

describe('bank statements', () => {
  const read = (csv: string) => {
    const grid = toGrid(XLSX.read(csv, { type: 'string', raw: true }));
    const headerRow = findHeaderRow(grid);
    const preset = detectPreset(grid[headerRow]!, BANK_PRESETS);
    const mapping = { headerRow, columns: mapColumns(grid[headerRow]!, preset), accountName: preset?.accountName ?? '' };
    return { preset: preset?.name, ...parseStatement(grid, mapping, DEFAULT_RULES) };
  };
  const hdfc = 'HDFC BANK Ltd.\nStatement of account\n\nDate,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance\n********,********\n'
    + '02/11/26,UPI-SWIGGY-swiggy@icici-ICIC0000-123-Pay,123,02/11/26,450.00,,1000.00\n'
    + '01/11/26,NEFT CR-ACME SALARY,9,01/11/26,,"1,25,000.00",126000.00\n';

  it('reads an HDFC layout with preamble rows', () => {
    const r = read(hdfc);
    expect(r.preset).toBe('HDFC');
    expect(r.rows.map((x) => x.draft)).toMatchObject([
      { date: '2026-11-02', merchant: 'Swiggy', amount: 450, type: 'Expense', category: 'Food & Dining', account: 'HDFC Savings' },
      { date: '2026-11-01', amount: 125000, type: 'Income', category: 'Salary' },
    ]);
    expect(r.skipped).toHaveLength(1);
  });
  it('reads ICICI and SBI layouts', () => {
    const icici = read('S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR ),Balance (INR )\n1,03/11/2026,03/11/2026,-,UPI/Uber India/uber@axl/ride,286.00,0.00,500\n');
    expect(icici.preset).toBe('ICICI');
    expect(icici.rows[0]?.draft).toMatchObject({ amount: 286, category: 'Transport', merchant: 'uber' });
    const sbi = read('Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance\n5 Nov 2026,5 Nov 2026,TO TRANSFER-UPI/DR/1234/NETFLIX/HDFC/x,,649.00,,100\n');
    expect(sbi.preset).toBe('SBI');
    expect(sbi.rows[0]?.draft).toMatchObject({ date: '2026-11-05', merchant: 'Netflix', category: 'Entertainment' });
  });
  it('flags ledger duplicates but keeps genuine repeats', () => {
    const row = read(hdfc).rows[0]!;
    const ledger = appendTransactions([], [{ ...row.draft, merchant: 'SWIGGY' }]);
    expect(flagDuplicates([row, row], ledger)).toEqual(['Duplicate', 'Repeat in file']);
    expect(flagDuplicates([row, row], [])).toEqual(['New', 'Repeat in file']);
  });
  it('leaves unfamiliar narrations alone', () => expect(cleanMerchant('Interest credit Q2')).toBe('Interest credit Q2'));
});

describe('sms alerts', () => {
  const sms = (s: string) => parseSms(s, DEFAULT_RULES, '2026-11-27');
  it('reads HDFC, ICICI and SBI shapes', () => {
    expect(sms('Sent Rs.450.00 From HDFC Bank A/C *1234 To SWIGGY On 24/11/26 Ref 631234567890 UPI')).toMatchObject(
      { amount: 450, merchant: 'Swiggy', date: '2026-11-24', type: 'Expense', category: 'Food & Dining', account: 'HDFC UPI' });
    expect(sms('ICICI Bank Acct XX123 debited for Rs 380.00 on 24-Nov-26; ZOMATO credited. UPI:6312.')).toMatchObject({ amount: 380, merchant: 'Zomato' });
    expect(sms('Dear UPI user SBI A/C X1234 debited by 286.0 on date 24Nov26 trf to Uber Refno 63123')).toMatchObject(
      { amount: 286, merchant: 'Uber', date: '2026-11-24', category: 'Transport' });
  });
  it('ignores balances and OTPs', () => {
    expect(sms('Rs 100 spent on ICICI Bank Credit Card XX9 at Amazon. Avl Lmt Rs 90,000')?.amount).toBe(100);
    expect(sms('123456 is the OTP for Rs 500 to be paid at Amazon')).toBeNull();
  });
  it('splits one-line alerts but keeps a multi-line alert whole', () => {
    expect(splitMessages('Sent Rs.1 To A\nSent Rs.2 To B')).toHaveLength(2);
    expect(splitMessages('Sent Rs.450\nFrom HDFC Bank\nTo SWIGGY\nAvl Bal Rs 5\n\nSent Rs.2 To B')).toHaveLength(2);
  });
  it('masks identifiers but keeps the amount', () => {
    const out = redact('Rs 450 from A/c XX1234 to 9876543210@ybl Ref No 631234567890 Avl Bal Rs 9,999.00');
    expect(out).toContain('Rs 450');
    expect(out).not.toMatch(/1234|9876543210|631234567890|9,999/);
    expect(amountAppears('paid 1,200.00', 1200)).toBe(true);
    expect(amountAppears('paid 1,200.00', 120)).toBe(false);
  });
});

describe('openrouter client', () => {
  afterEach(() => vi.unstubAllGlobals());
  const settings = { apiKey: 'test-key', model: 'openrouter/free' };
  const stub = (content: unknown, status = 200) => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('sends one batch and drops unknown ids and categories', async () => {
    const f = stub({ items: [{ id: 1, category: 'Shopping', type: 'Expense' }, { id: 2, category: 'Nonsense' }, { id: 99, category: 'Health' }] });
    const out = await aiBatch([{ id: 1, text: 'a 631234567890' }, { id: 2, text: 'b' }], settings);
    expect(out.map((r) => r.id)).toEqual([1]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0]![1].body)).not.toContain('631234567890');
  });
  it('audits with totals and limits only', async () => {
    const f = stub({ recommendations: [{ title: 't', detail: 'd' }] });
    const data = mergeTransactions([], [{ ...draft, merchant: 'SecretMerchant', account: 'SecretAccount', subCategory: 'SecretSub' }]).transactions;
    await aiInsights(auditPayload('2026-11', categoryVsBudget(data, [], '2026-11')), settings);
    const body = String(f.mock.calls[0]![1].body);
    expect(body).toContain('Food & Dining');
    expect(body).not.toContain('Secret');
  });
  it('explains HTTP failures', async () => {
    stub({}, 401);
    await expect(aiBatch([{ id: 1, text: 'a' }], settings)).rejects.toThrow('API key was rejected');
  });
});

describe('regressions', () => {
  const known = ['HDFC UPI', 'ICICI Credit Card', 'SBI Savings', 'Cash', 'HDFC Savings'];
  const q = (s: string) => parseQuickAdd(s, DEFAULT_RULES, known, '2026-11-27')!;

  it('never swaps the named bank for another', () => {
    expect(q('12000 emi hdfc credit card')).toMatchObject({ account: 'HDFC Credit Card', merchant: 'Emi' });
    expect(q('500 groceries sbi upi').account).toBe('SBI UPI');
    expect(q('200 coffee icici upi').account).toBe('ICICI UPI');
    expect(q('450 swiggy hdfc upi').account).toBe('HDFC UPI');
    expect(q('900 books icici').account).toBe('ICICI Credit Card');
  });
  it('treats ATM withdrawals and card bills as transfers', () => {
    expect(q('1000 atm withdrawal').type).toBe('Transfer');
    expect(q('5000 credit card bill')).toMatchObject({ type: 'Transfer', account: 'Cash' });
    expect(classify('Atm', 'ATW-416021XXXX-MG ROAD', true, DEFAULT_RULES).type).toBe('Transfer');
    expect(q('25 atm annual fee').type).toBe('Expense');
  });
  it('labels ATM and card-payment alerts', () => {
    const sms = (s: string) => parseSms(s, DEFAULT_RULES, '2026-11-27');
    expect(sms('Rs 5000 withdrawn from HDFC Bank ATM at MG ROAD on 24/11/26')).toMatchObject({ merchant: 'ATM Withdrawal', type: 'Transfer' });
    expect(sms('Payment of Rs 8000 received towards your ICICI Bank Credit Card XX12 on 24-Nov-26')).toMatchObject({ merchant: 'Credit Card Payment', type: 'Transfer', amount: 8000 });
  });
  it('masks the identifiers that used to get through', () => {
    const out = redact('Dear Ravi Kumar, PAN ABCDE1234F, mob 98765 43210, card 4160 2112 3456 7890, ravi.k@okhdfc paid Rs 5');
    expect(out).not.toMatch(/Ravi|Kumar|ABCDE|98765|43210|4160|3456|7890|ravi/);
    expect(redact('Rs 100000 on 24-11-26')).toBe('Rs 100000 on 24-11-26');
  });
  it('keeps account names and identifiers out of AI parse', async () => {
    const fetchMock = vi.fn(async (_u: string, _i: RequestInit) => new Response(JSON.stringify(
      { choices: [{ message: { content: JSON.stringify({ date: '2026-11-27', amount: 50, merchant: 'Tea', account: 'Wrong' }) } }] })));
    vi.stubGlobal('fetch', fetchMock);
    const out = await aiParse('50 tea sbi 9876543210', ['SBI Savings', 'My Secret Account'], '2026-11-27', { apiKey: 'k', model: 'openrouter/free' });
    vi.unstubAllGlobals();
    expect(out.account).toBe('SBI Savings');
    expect(String(fetchMock.mock.calls[0]![1].body)).not.toMatch(/Secret|SBI Savings|9876543210/);
  });
  it('keeps valid records when one is bad', () => {
    const revive = list(parseTransaction);
    expect(() => revive([draft, { amount: 'x' }])).toThrow(expect.objectContaining({ dropped: 1, value: [draft] }));
  });
  it('returns to the 31st after February', () => {
    const feb = nextDue('2027-01-31', 1);
    expect(feb.date).toBe('2027-02-28');
    expect(nextDue(feb.date, 1, feb.day).date).toBe('2027-03-31');
    expect(nextDue('2027-02-10', 1, 31).date).toBe('2027-03-10');
  });
  it('counts every missed period of an overdue bill', () => {
    const bill = { id: 'b', name: 'Rent', amount: 100, frequency: 'Monthly' as const, nextDueDate: '2026-09-05', category: 'Rent & Housing', account: 'Cash' };
    expect(safeToSpend([], [bill], 0, '2026-11-27').fixedBills).toBe(300);
  });
});

describe('file limits', () => {
  const file = (name: string, body: string) => new File([body], name);
  it('refuses oversized files and too many rows, and reads normal ones', async () => {
    await expect(readFile(file('a.csv', 'x'.repeat(MAX_BYTES + 1)))).rejects.toThrow('10 MB');
    await expect(readFile(file('a.csv', 'a\n'.repeat(MAX_ROWS + 5)))).rejects.toThrow('rows');
    await expect(readFile(file('a.csv', 'date\n01/01/2026\n'))).resolves.toBeTruthy();
  });
});

describe('app lock', () => {
  const K = 'fin_tracker_v1_transactions';
  beforeEach(() => {
    forgetKey();
    const store: Record<string, unknown> = {};
    // Methods are hidden from Object.keys, as with the real Storage object.
    Object.defineProperties(store, {
      getItem: { value: (k: string) => (k in store ? store[k] : null) },
      setItem: { value: (k: string, v: string) => { store[k] = v; } },
      removeItem: { value: (k: string) => { delete store[k]; } },
    });
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('encrypts existing and new values, and only the right passphrase opens them', async () => {
    localStorage.setItem(K, 'secret-merchant');
    await enableLock('correct horse battery');
    expect(localStorage.getItem(K)).toMatch(/^enc1:/);
    expect(localStorage.getItem(K)).not.toContain('secret');
    write(K, 'new-secret');
    expect(localStorage.getItem(K)).not.toContain('secret');
    forgetKey();
    expect(() => read(K)).toThrow('locked');
    expect(() => write(K, 'x')).toThrow();
    expect(await unlock('wrong passphrase!')).toBe(false);
    expect(await unlock('correct horse battery')).toBe(true);
    expect(read(K)).toBe('new-secret');
    expect(await disableLock('correct horse battery')).toBe(true);
    expect(localStorage.getItem(K)).toBe('new-secret');
  }, 30_000);
  it('rejects short passphrases and swapped ciphertext', async () => {
    await expect(enableLock('short')).rejects.toThrow('at least');
    await enableLock('correct horse battery');
    write(K, 'a');
    localStorage.setItem('fin_tracker_v1_budgets', localStorage.getItem(K)!);
    expect(() => read('fin_tracker_v1_budgets')).toThrow();
  }, 30_000);
});

describe('stronger masking and retention', () => {
  it('hides listed words and transfer payee names', () => {
    expect(redact('UPI to Priya Sharma for dinner', 'priya sharma')).toBe('UPI to [private] for dinner');
    expect(redact('NEFT CR-RAVI KUMAR rent')).not.toMatch(/RAVI|KUMAR/);
    expect(redact('NEFT CR-ACME SALARY')).toContain('SALARY');
  });
  it('asks for providers that do not store prompts', async () => {
    const f = vi.fn(async (_u: string, _i: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: '{"items":[]}' } }] })));
    vi.stubGlobal('fetch', f);
    await aiBatch([{ id: 1, text: 'a' }], { apiKey: 'k', model: 'openrouter/free' });
    vi.unstubAllGlobals();
    expect(JSON.parse(String(f.mock.calls[0]![1].body)).provider).toEqual({ max_price: { prompt: 0, completion: 0, request: 0 }, data_collection: 'deny' });
  });
});

describe('free models only', () => {
  it('offers only free choices and refuses paid ones before any request', async () => {
    expect(MODEL_CHOICES.every(isFreeModel)).toBe(true);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    for (const model of ['google/gemini-3.5-flash', '~google/gemini-flash-latest', 'openrouter/auto', 'x/y:free:online']) {
      await expect(aiBatch([{ id: 1, text: 'a' }], { apiKey: 'k', model })).rejects.toThrow('only free models');
    }
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
