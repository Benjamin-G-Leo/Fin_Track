import type { KeywordRule, TransactionDraft } from '../types';
import { cleanMerchant, classify } from './statement';
import { isAtmWithdrawal, isCardBill } from './transfers';
import { parseAmount, parseDate } from './validate';

const NOISE = /\b(otp|one[- ]time password|will be debited|payment due|is due|declined|failed|requested money)\b/i;
const BALANCE = /\b(?:avl\.?|available|clear|closing|total)?\s*(?:bal(?:ance)?|lmt|limit)\b[^\d\n]{0,12}[\d,]+(?:\.\d+)?/gi;
const AMOUNT = /(?:₹|\brs\.?|\binr)\s?([\d,]+(?:\.\d+)?)|\b(?:debited|credited)\s+(?:by|for|with)\s+([\d,]+(?:\.\d+)?)/i;
const DEBIT = /\b(debited|spent|sent|paid|withdrawn|purchase)\b/i;
const CREDIT = /\b(credited|received|deposited|refund(?:ed)?)\b/i;

const hasAmount = (line: string) => AMOUNT.test(line.replace(BALANCE, ' '));

/** Blank lines separate messages; a block with several amount lines is one message per line. */
export function splitMessages(pasted: string): string[] {
  return pasted.split(/\n\s*\n/).flatMap((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    return lines.filter(hasAmount).length > 1 ? lines : [lines.join(' ')];
  });
}

export const isNoise = (message: string): boolean => NOISE.test(message);

function findDate(message: string): string | null {
  const m = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2})|\d{1,2}[ -]?[A-Za-z]{3}[ -]?(?:\d{4}|\d{2}))\b/.exec(message)?.[1];
  if (!m) return null;
  return parseDate(m.replace(/^(\d{1,2})[ -]?([A-Za-z]{3})[ -]?(\d+)$/, '$1 $2 $3'));
}

function findPayee(message: string, isDebit: boolean): string {
  const end = String.raw`(?=\s+(?:on|ref(?:\s*no)?|utr|upi|via|avl|bal|not)\b|\s+credited\b|[.;,(]\s|[.;,]?$)`;
  const patterns = isDebit
    ? [`;\\s*(.+?)\\s+credited\\b`, `\\b(?:trf to|to vpa|to|at|towards)\\s+(.+?)${end}`]
    : [`\\b(?:from vpa|from|by)\\s+(?!rs|inr|₹)(.+?)${end}`];
  for (const p of patterns) {
    const found = new RegExp(p, 'i').exec(message)?.[1]?.trim();
    if (found) return cleanMerchant(found.includes('@') ? found.split('@')[0]! : found);
  }
  return '';
}

function findAccount(message: string): string {
  const bank = /\b(HDFC|ICICI|SBI|Axis|Kotak)/i.exec(message)?.[1];
  if (!bank) return 'Bank';
  const name = bank.length <= 4 || /icici/i.test(bank) ? bank.toUpperCase() : bank;
  const kind = /credit card/i.test(message) ? 'Credit Card' : /\b(upi|vpa)\b/i.test(message) ? 'UPI' : 'Savings';
  return `${name} ${kind}`;
}

/** Offline parser for one alert. Returns null when it is not confident of amount, direction and payee. */
export function parseSms(message: string, rules: KeywordRule[], today: string): TransactionDraft | null {
  if (isNoise(message)) return null;
  const body = message.replace(BALANCE, ' ');
  const money = AMOUNT.exec(body);
  const amount = money ? parseAmount(money[1] ?? money[2]) : null;
  const debitAt = body.search(DEBIT), creditAt = body.search(CREDIT);
  if (!amount || (debitAt < 0 && creditAt < 0)) return null;
  const isDebit = debitAt >= 0 && (creditAt < 0 || debitAt < creditAt || /\bcredit card\b/i.test(body));
  // ATM and card-bill alerts name a place or nothing at all, so they get a fixed label.
  const merchant = isAtmWithdrawal(body) ? 'ATM Withdrawal' : isCardBill(body) ? 'Credit Card Payment' : findPayee(body, isDebit);
  if (!merchant) return null;
  return {
    date: findDate(body) ?? today, amount, merchant, account: findAccount(message), isReimbursable: false,
    ...classify(merchant, body, isDebit, rules),
  };
}

/** Guards against invented figures: the model's amount must appear in the message itself. */
export const amountAppears = (message: string, amount: number): boolean =>
  (message.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).some((n) => parseAmount(n) === amount);
