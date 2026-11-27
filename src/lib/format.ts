const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

export const formatINR = (n: number): string => inr.format(n);
export const formatINRCompact = (n: number): string => compact.format(n);
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
