import type { AppData, Budget, RecurringBill, SinkingFund, TransactionDraft } from '../types';
import { addDays, addMonths, monthKey } from './dates';
import { baseId, uniqueId } from './ids';

type Row = [day: number, type: TransactionDraft['type'], amount: number, category: TransactionDraft['category'],
  subCategory: string, nature: TransactionDraft['spendingNature'], account: string, merchant: string, reimbursable?: boolean];

const ROWS: Row[] = [
  [1, 'Income', 125000, 'Salary', 'Monthly Pay', 'Savings', 'SBI Savings', 'Acme Technologies Salary'],
  [2, 'Expense', 28000, 'Rent & Housing', 'Rent', 'Fixed Need', 'SBI Savings', 'House Rent'],
  [3, 'Investment', 10000, 'Investments', 'Mutual Funds', 'Savings', 'SBI Savings', 'Groww Index Fund SIP'],
  [4, 'Investment', 5000, 'Investments', 'Retirement', 'Savings', 'SBI Savings', 'PPF Deposit'],
  [5, 'Expense', 1840, 'Utilities & Bills', 'Electricity', 'Fixed Need', 'HDFC UPI', 'BESCOM Electricity'],
  [6, 'Expense', 999, 'Utilities & Bills', 'Broadband', 'Fixed Need', 'ICICI Credit Card', 'Airtel Broadband'],
  [8, 'Expense', 2365, 'Food & Dining', 'Groceries', 'Variable Need', 'HDFC UPI', 'BigBasket'],
  [10, 'Expense', 450, 'Food & Dining', 'Delivery', 'Want', 'HDFC UPI', 'Swiggy'],
  [12, 'Expense', 286, 'Transport', 'Cab', 'Variable Need', 'HDFC UPI', 'Uber'],
  [14, 'Expense', 2000, 'Transport', 'Fuel', 'Variable Need', 'ICICI Credit Card', 'HPCL Petrol Pump'],
  [16, 'Expense', 3499, 'Shopping', 'Online', 'Want', 'ICICI Credit Card', 'Amazon'],
  [18, 'Expense', 800, 'Food & Dining', 'Dining Out', 'Want', 'ICICI Credit Card', 'Toit Dinner (my share)'],
  [18, 'Expense', 2400, 'Food & Dining', 'Dining Out', 'Want', 'ICICI Credit Card', 'Dinner split - Rahul & Priya', true],
  [21, 'Expense', 649, 'Entertainment', 'Subscriptions', 'Want', 'ICICI Credit Card', 'Netflix'],
  [23, 'Expense', 720, 'Health', 'Medical', 'Variable Need', 'Cash', 'Apollo Pharmacy'],
];

const BUDGETS: Budget[] = [
  ['Food & Dining', 9000], ['Rent & Housing', 28000], ['Transport', 4000], ['Utilities & Bills', 4000],
  ['Shopping', 5000], ['Health', 2000], ['Entertainment', 1500],
].map(([category, monthlyLimit]) => ({ category: category as string, monthlyLimit: monthlyLimit as number }));

/** Dates are relative to today so the sample always lands in the current month. */
export function sampleData(today: string): Omit<AppData, 'rules'> {
  const month = monthKey(today);
  const todayDay = Number(today.slice(8));
  const transactions: AppData['transactions'] = [];
  for (const [day, type, amount, category, subCategory, spendingNature, account, merchant, isReimbursable = false] of ROWS) {
    const date = `${month}-${String(Math.min(day, todayDay)).padStart(2, '0')}`;
    const draft = { date, type, amount, category, subCategory, spendingNature, account, merchant, isReimbursable };
    transactions.push({ ...draft, id: uniqueId(draft, transactions) });
  }
  const bill = (key: string, name: string, amount: number, frequency: RecurringBill['frequency'], nextDueDate: string, category: string, account: string): RecurringBill =>
    ({ id: `sample_bill_${key}`, name, amount, frequency, nextDueDate, category, account });
  const fund = (key: string, goalName: string, targetAmount: number, currentSaved: number, months: number): SinkingFund =>
    ({ id: `sample_fund_${key}`, goalName, targetAmount, currentSaved, targetDate: addMonths(today, months) });
  return {
    transactions,
    budgets: BUDGETS,
    bills: [
      bill('mobile', 'Jio Postpaid', 599, 'Monthly', addDays(today, 2), 'Utilities & Bills', 'HDFC UPI'),
      bill('maid', 'Domestic Help', 2500, 'Monthly', addDays(today, 3), 'Rent & Housing', 'Cash'),
      bill('rent', 'House Rent', 28000, 'Monthly', addMonths(`${month}-02`, 1), 'Rent & Housing', 'SBI Savings'),
      bill('insurance', 'Health Insurance', 14500, 'Yearly', addMonths(today, 4), 'Health', 'ICICI Credit Card'),
    ],
    funds: [
      fund('emergency', 'Emergency Fund', 300000, 120000, 18),
      fund('trip', 'Goa Trip', 45000, 15000, 5),
      fund('laptop', 'New Laptop', 90000, 30000, 8),
    ],
  };
}

export interface SampleManifest { transactions: string[]; budgets: Budget[]; bills: string[]; funds: string[] }

export const manifestOf = (s: Omit<AppData, 'rules'>): SampleManifest => ({
  transactions: s.transactions.map((t) => t.id), budgets: s.budgets,
  bills: s.bills.map((b) => b.id), funds: s.funds.map((f) => f.id),
});

/** Removes only what was seeded. Records you added, and budgets you changed, are kept. */
export function removeSample(data: AppData, m: SampleManifest): AppData {
  return {
    ...data,
    transactions: data.transactions.filter((t) => !m.transactions.includes(t.id)),
    budgets: data.budgets.filter((b) => !m.budgets.some((s) => s.category === b.category && s.monthlyLimit === b.monthlyLimit)),
    bills: data.bills.filter((b) => !m.bills.includes(b.id)),
    funds: data.funds.filter((f) => !m.funds.includes(f.id)),
  };
}

/** Adds the sample alongside existing records without overwriting any of them. */
export function addSample(data: AppData, today: string): { next: AppData; manifest: SampleManifest } {
  const s = sampleData(today);
  const have = new Set(data.transactions.map((t) => baseId(t)));
  const added = {
    transactions: s.transactions.filter((t) => !have.has(baseId(t))),
    budgets: s.budgets.filter((b) => !data.budgets.some((x) => x.category === b.category)),
    bills: s.bills.filter((b) => !data.bills.some((x) => x.id === b.id)),
    funds: s.funds.filter((f) => !data.funds.some((x) => x.id === f.id)),
  };
  return {
    manifest: manifestOf(added),
    next: {
      rules: data.rules,
      transactions: [...data.transactions, ...added.transactions],
      budgets: [...data.budgets, ...added.budgets],
      bills: [...data.bills, ...added.bills],
      funds: [...data.funds, ...added.funds],
    },
  };
}
