import type { Transaction, TransactionDraft } from '../types';

export const normalizeMerchant = (merchant: string): string =>
  merchant.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '');

/** cyrb53: small, fast, deterministic string hash. */
function hash(input: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const baseId = (t: Pick<TransactionDraft, 'date' | 'amount' | 'merchant'>): string =>
  `tx_${hash(`${t.date}|${t.amount.toFixed(2)}|${normalizeMerchant(t.merchant)}`)}`;

export const countMatches = (list: Transaction[], base: string): number =>
  list.filter((t) => t.id === base || t.id.startsWith(`${base}-`)).length;

/** The base hash, suffixed only when the user keeps a genuine repeat. */
export function uniqueId(draft: TransactionDraft, existing: Transaction[]): string {
  const base = baseId(draft);
  const taken = new Set(existing.map((t) => t.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Merges imported rows by occurrence count: if a hash appears N times in the file and M times
 * already, only N − M are added. Re-importing the same file therefore adds nothing.
 */
export function mergeTransactions(existing: Transaction[], incoming: TransactionDraft[]) {
  const have = new Map<string, number>();
  const result = [...existing];
  const seen = new Map<string, number>();
  let added = 0, skipped = 0;
  for (const draft of incoming) {
    const base = baseId(draft);
    if (!have.has(base)) have.set(base, countMatches(existing, base));
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if (n <= (have.get(base) ?? 0)) { skipped++; continue; }
    result.push({ ...draft, id: uniqueId(draft, result) });
    added++;
  }
  return { transactions: result, added, skipped };
}

export const randomId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
