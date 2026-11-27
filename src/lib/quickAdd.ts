import { CATEGORIES, type Category, type KeywordRule, type TransactionDraft, type TransactionType } from '../types';
import { detectAccount } from './accounts';
import { addDays, makeISO, todayISO } from './dates';
import { round2 } from './format';
import { matchRule } from './rules';
import { isCardBill, isOwnTransfer } from './transfers';
import { defaultNature, oneOf } from './validate';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MULTIPLIERS: Record<string, number> = { k: 1e3, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7 };

/**
 * Parses lines such as "450 swiggy hdfc upi yesterday" or "salary 1.25L sbi savings 1/11".
 * Returns null when no positive amount can be found.
 */
export function parseQuickAdd(
  input: string, rules: KeywordRule[], accounts: string[], today = todayISO(),
): TransactionDraft | null {
  let rest = ` ${input.trim()} `;
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(rest);
    if (m) rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
    return m;
  };

  const isReimbursable = !!take(/(?<=\s)(#r|#reimb\w*|reimbursable)(?=\s)/i);

  // Dates are removed first so their digits are never read as the amount.
  let date = today;
  const year = Number(today.slice(0, 4));
  const pastIfFuture = (y: number, mo: number, d: number): string | null => {
    const iso = makeISO(y, mo, d);
    return iso && iso > today ? makeISO(y - 1, mo, d) : iso;
  };
  let m: RegExpExecArray | null;
  if (take(/(?<=\s)day before yesterday(?=\s)/i)) date = addDays(today, -2);
  else if (take(/(?<=\s)yesterday(?=\s)/i)) date = addDays(today, -1);
  else if (take(/(?<=\s)today(?=\s)/i)) date = today;
  else if ((m = take(/(?<=\s)(\d{1,3}) days? ago(?=\s)/i))) date = addDays(today, -Number(m[1]));
  else if ((m = take(/(?<=\s)(\d{4})-(\d{2})-(\d{2})(?=\s)/))) date = makeISO(Number(m[1]), Number(m[2]), Number(m[3])) ?? today;
  else if ((m = take(/(?<=\s)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?(?=\s)/))) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null];
    date = (y === null ? pastIfFuture(year, mo, d) : makeISO(y < 100 ? 2000 + y : y, mo, d)) ?? today;
  } else if ((m = take(/(?<=\s)(\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?=\s)/i))) {
    date = pastIfFuture(year, MONTHS.indexOf(m[2]!.toLowerCase()) + 1, Number(m[1])) ?? today;
  }

  // Amount: a currency-marked or suffixed number wins, otherwise the largest bare number.
  const amountRe = /(?<=\s)(₹\s?|rs\.?\s?|inr\s?)?(\d[\d,]*(?:\.\d+)?)(k|l|\s?(?:lakhs?|lac|crore|cr))?(\/-)?(?=\s)/gi;
  const found = [...rest.matchAll(amountRe)].map((x) => ({
    index: x.index, length: x[0].length, marked: !!(x[1] || x[3] || x[4]),
    value: round2(Number(x[2]!.replace(/,/g, '')) * (MULTIPLIERS[x[3]?.trim().toLowerCase() ?? ''] ?? 1)),
  })).filter((x) => x.value > 0);
  const chosen = found.sort((a, b) => Number(b.marked) - Number(a.marked) || b.value - a.value)[0];
  if (!chosen) return null;
  rest = rest.slice(0, chosen.index) + ' ' + rest.slice(chosen.index + chosen.length);

  const cardBill = isCardBill(input);
  // "credit card bill" says what was paid, not which account paid it.
  const named = detectAccount(rest, accounts, cardBill);
  const account = named.account;
  rest = named.rest;

  const tag = take(/(?<=\s)#(\S+)(?=\s)/);
  const merchantText = rest.replace(/(?<=\s)(paid|spent|on|for|at|to|via|from|using|by)(?=\s)/gi, ' ').replace(/\s+/g, ' ').trim();
  const rule = matchRule(input, rules);
  const taggedCategory = tag ? CATEGORIES.find((c) => c.toLowerCase().startsWith(tag[1]!.toLowerCase())) : undefined;
  let category: Category = taggedCategory ?? oneOf(rule?.category, CATEGORIES) ?? 'Other';

  let type: TransactionType = 'Expense';
  if (isOwnTransfer(input) || /\btransfer(red)?\b/i.test(input)) { type = 'Transfer'; category = 'Other'; }
  else if (category === 'Salary' || /\b(income|received|credited|refund|cashback|interest|dividend)\b/i.test(input)) type = 'Income';
  else if (category === 'Investments' || /\b(invest(ed|ment)?|sip)\b/i.test(input)) { type = 'Investment'; category = 'Investments'; }

  const merchant = merchantText || rule?.keyword || category;
  return {
    date, type, amount: chosen.value, category,
    subCategory: category === rule?.category ? rule.subCategory : '',
    spendingNature: category === rule?.category && type === 'Expense' ? rule.spendingNature : defaultNature(type, category),
    account: account || 'Cash',
    merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1),
    isReimbursable,
  };
}
