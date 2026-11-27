export const TRANSACTION_TYPES = ['Expense', 'Income', 'Transfer', 'Investment'] as const;
export const CATEGORIES = [
  'Food & Dining', 'Rent & Housing', 'Transport', 'Utilities & Bills', 'Shopping',
  'Health', 'Entertainment', 'Salary', 'Investments', 'Other',
] as const;
export const SPENDING_NATURES = ['Fixed Need', 'Variable Need', 'Want', 'Savings'] as const;
export const FREQUENCIES = ['Monthly', 'Quarterly', 'Yearly'] as const;
export const MONTHS_PER: Record<(typeof FREQUENCIES)[number], number> = { Monthly: 1, Quarterly: 3, Yearly: 12 };
export const DEFAULT_ACCOUNTS = ['HDFC UPI', 'ICICI Credit Card', 'SBI Savings', 'Cash'];

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type Category = (typeof CATEGORIES)[number];
export type SpendingNature = (typeof SPENDING_NATURES)[number];
export type Frequency = (typeof FREQUENCIES)[number];

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: Category;
  subCategory: string;
  spendingNature: SpendingNature;
  account: string;
  merchant: string;
  isReimbursable: boolean;
}
export type TransactionDraft = Omit<Transaction, 'id'>;

export interface Budget { category: string; monthlyLimit: number }
export interface RecurringBill {
  id: string; name: string; amount: number; frequency: Frequency;
  nextDueDate: string; category: string; account: string;
}
export interface SinkingFund {
  id: string; goalName: string; targetAmount: number; currentSaved: number; targetDate: string;
}
export interface KeywordRule {
  keyword: string; category: string; subCategory: string; spendingNature: SpendingNature;
}
export interface AppData {
  transactions: Transaction[];
  budgets: Budget[];
  bills: RecurringBill[];
  funds: SinkingFund[];
  rules: KeywordRule[];
}
