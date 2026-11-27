import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const Card = ({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) => (
  <section className="min-w-0 rounded-xl border border-line bg-surface p-4">
    {(title || action) && (
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>{action}
      </header>
    )}
    {children}
  </section>
);

type Variant = 'primary' | 'secondary' | 'danger';
const styles: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent border-accent',
  secondary: 'bg-surface text-ink border-line',
  danger: 'bg-surface text-danger border-line',
};
export const Button = ({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) => (
  <button type="button" {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} />
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-xs font-medium text-muted"><span className="mb-1 block">{label}</span>{children}</label>
);

export const Select = ({ value, options, onChange, label }: { value: string; options: readonly string[]; onChange: (v: string) => void; label?: string }) => (
  <select className="field" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => <option key={o}>{o}</option>)}
  </select>
);

export const Progress = ({ percent, over = false, label }: { percent: number; over?: boolean; label: string }) => (
  <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
    <div className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, percent)}%` }} />
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-8 text-center text-sm text-muted">{children}</p>;
