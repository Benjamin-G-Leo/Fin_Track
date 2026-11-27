const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (never via toISOString, which shifts to UTC). */
export const toISO = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = (): string => toISO(new Date());

export function makeISO(year: number, month: number, day: number): string | null {
  const d = new Date(year, month - 1, day);
  if (year < 1900 || year > 2200 || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toISO(d);
}

export function parseISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m && makeISO(Number(m[1]), Number(m[2]), Number(m[3])) ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Adds months, clamping to the last day of a shorter month (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const d = parseISO(iso) ?? new Date();
  const first = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  first.setDate(Math.min(d.getDate(), last));
  return toISO(first);
}

export function daysBetween(from: string, to: string): number {
  const a = parseISO(from), b = parseISO(to);
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) : 0;
}

export const monthKey = (iso: string): string => iso.slice(0, 7);
export const shiftMonth = (month: string, by: number): string => monthKey(addMonths(`${month}-01`, by));
export const monthLabel = (month: string): string =>
  (parseISO(`${month}-01`) ?? new Date()).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
export const dateLabel = (iso: string): string =>
  parseISO(iso)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) ?? iso;
