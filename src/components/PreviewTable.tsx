import { dateLabel } from '../lib/dates';
import { formatINR } from '../lib/format';
import type { Status, StatementRow } from '../lib/statement';
import { defaultNature } from '../lib/validate';
import { CATEGORIES, TRANSACTION_TYPES, type Category, type TransactionDraft, type TransactionType } from '../types';
import { Select } from './ui';

export default function PreviewTable({ rows, statuses, included, onPick, onEdit }: {
  rows: StatementRow[];
  statuses: Status[];
  included: boolean[];
  onPick: (line: number, checked: boolean) => void;
  onEdit: (line: number, patch: Partial<TransactionDraft>) => void;
}) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-line">
      <table className="w-full min-w-[46rem] text-sm">
        <thead className="sticky top-0 bg-surface text-left">
          <tr>{['Import', 'Status', 'Date', 'Merchant', 'Amount', 'Type', 'Category'].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.line} className="border-t border-line">
              <td className="p-2"><input type="checkbox" aria-label={`Import row ${r.line}`} checked={included[i]} onChange={(e) => onPick(r.line, e.target.checked)} /></td>
              <td className={`p-2 whitespace-nowrap ${statuses[i] === 'New' ? '' : 'text-warn'}`}>{statuses[i]}</td>
              <td className="p-2 whitespace-nowrap">{dateLabel(r.draft.date)}</td>
              <td className="max-w-56 truncate p-2" title={r.narration}>{r.draft.merchant}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(r.draft.amount)}</td>
              <td className="p-2">
                <Select label={`Type for row ${r.line}`} value={r.draft.type} options={TRANSACTION_TYPES}
                  onChange={(v) => onEdit(r.line, { type: v as TransactionType, spendingNature: defaultNature(v as TransactionType, r.draft.category) })} />
              </td>
              <td className="p-2">
                <Select label={`Category for row ${r.line}`} value={r.draft.category} options={CATEGORIES}
                  onChange={(v) => onEdit(r.line, { category: v as Category, subCategory: '', spendingNature: defaultNature(r.draft.type, v as Category) })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
