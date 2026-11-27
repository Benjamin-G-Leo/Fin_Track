import type { Category, KeywordRule, SpendingNature } from '../types';

const group = (category: Category, subCategory: string, spendingNature: SpendingNature, keywords: string): KeywordRule[] =>
  keywords.split(',').map((keyword) => ({ keyword, category, subCategory, spendingNature }));

export const DEFAULT_RULES: KeywordRule[] = [
  ...group('Food & Dining', 'Delivery', 'Want', 'swiggy,zomato'),
  ...group('Food & Dining', 'Dining Out', 'Want', 'restaurant,cafe,starbucks,dominos,pizza'),
  ...group('Food & Dining', 'Groceries', 'Variable Need', 'bigbasket,blinkit,zepto,dmart,grocery,groceries,milk,vegetables'),
  ...group('Rent & Housing', 'Rent', 'Fixed Need', 'rent,maintenance'),
  ...group('Transport', 'Cab', 'Variable Need', 'uber,ola,rapido,auto'),
  ...group('Transport', 'Fuel', 'Variable Need', 'petrol,diesel,fuel,hpcl,bpcl,indian oil'),
  ...group('Transport', 'Public Transit', 'Variable Need', 'metro,irctc,bus'),
  ...group('Utilities & Bills', 'Bills', 'Fixed Need', 'electricity,water bill,broadband,wifi,airtel,jio,recharge,gas cylinder'),
  ...group('Shopping', 'Online', 'Want', 'amazon,flipkart,myntra,ajio'),
  ...group('Health', 'Medical', 'Variable Need', 'pharmacy,apollo,medplus,doctor,hospital,medicine'),
  ...group('Health', 'Fitness', 'Want', 'gym,cultfit'),
  ...group('Entertainment', 'Subscriptions', 'Want', 'netflix,spotify,hotstar,prime video,youtube'),
  ...group('Entertainment', 'Movies', 'Want', 'bookmyshow,pvr,inox,movie'),
  ...group('Salary', 'Monthly Pay', 'Savings', 'salary,payroll'),
  ...group('Investments', 'Mutual Funds', 'Savings', 'sip,mutual fund,zerodha,groww'),
  ...group('Investments', 'Retirement', 'Savings', 'ppf,nps,epf'),
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word, case-insensitive match; the longest (most specific) keyword wins. */
export function matchRule(textValue: string, rules: KeywordRule[]): KeywordRule | null {
  let best: KeywordRule | null = null;
  for (const rule of rules) {
    if (!rule.keyword) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(rule.keyword)}($|[^\\p{L}\\p{N}])`, 'iu');
    if (re.test(textValue) && (!best || rule.keyword.length > best.keyword.length)) best = rule;
  }
  return best;
}
