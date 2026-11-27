const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak'];
const KINDS: [RegExp, string][] = [
  [/\bcredit ?card\b/i, 'Credit Card'], [/\bupi\b/i, 'UPI'], [/\bsavings\b/i, 'Savings'], [/\bcash\b/i, 'Cash'],
];
const wordRe = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');

/**
 * Finds the account named in a line and returns the line without it. A named bank is never swapped
 * for another: if no known account fits, one is named after what was typed.
 */
export function detectAccount(line: string, accounts: string[], ignoreCard = false): { account: string | null; rest: string } {
  for (const name of [...accounts].sort((a, b) => b.length - a.length)) {
    if (wordRe(name).test(line)) return { account: name, rest: line.replace(wordRe(name), ' ') };
  }
  const bank = BANKS.find((b) => wordRe(b).test(line));
  const kind = KINDS.find(([re, label]) => !(ignoreCard && label === 'Credit Card') && re.test(line));
  if (!bank && !kind) return { account: null, rest: line };
  let rest = line;
  if (bank) rest = rest.replace(wordRe(bank), ' ');
  if (kind) rest = rest.replace(kind[0], ' ');
  const label = kind?.[1];
  const fits = accounts.filter((a) => (!bank || wordRe(bank).test(a)) && (!label || a.toLowerCase().includes(label.toLowerCase())));
  // With a bank but no kind, prefer its savings account.
  const known = (!label && fits.find((a) => /savings/i.test(a))) || fits[0];
  if (known) return { account: known, rest };
  if (label === 'Cash') return { account: 'Cash', rest };
  return { account: bank ? `${bank} ${label ?? 'Savings'}` : label!, rest };
}
