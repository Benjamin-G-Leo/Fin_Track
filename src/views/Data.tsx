import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, Card, Field, Select } from '../components/ui';
import { todayISO } from '../lib/dates';
import { applyImport, exportExcel, importExcel } from '../lib/excel';
import { mergeTransactions } from '../lib/ids';
import { useStored } from '../lib/storage';
import { aiSettings, db, useData } from '../store';
import type { AppData } from '../types';

const MERGE = 'Merge with current data';
const REPLACE = 'Replace sheets found in the file';

export default function DataView() {
  const data = useData();
  const ai = useStored(aiSettings);
  const [mode, setMode] = useState(MERGE);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const commit = (next: AppData) => {
    db.transactions.set(next.transactions); db.budgets.set(next.budgets); db.bills.set(next.bills);
    db.funds.set(next.funds); db.rules.set(next.rules);
  };

  const onFile = async (file: File) => {
    setMessage(''); setErrors([]);
    try {
      const parsed = await importExcel(file);
      setErrors(parsed.errors);
      if (!parsed.present.size) return;
      const replace = mode === REPLACE;
      const { next, added, skipped } = applyImport(data, parsed, replace ? 'replace' : 'merge', mergeTransactions);
      if (replace) {
        const rejected = parsed.errors.length ? ` ${parsed.errors.length} invalid rows will NOT be imported.` : '';
        if (!window.confirm(`Replace ${[...parsed.present].join(', ')} with the file's contents?${rejected} Export a backup first if unsure.`)) return;
      }
      commit(next);
      setMessage(`Imported: ${added} transactions added, ${skipped} duplicates skipped.`);
    } catch {
      setMessage('That file could not be read as a spreadsheet.');
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Excel export">
        <p className="mb-3 text-sm text-muted">Everything except your API key, one sheet per record type. Browser storage can be cleared, so export regularly as a backup.</p>
        <Button variant="primary" onClick={() => exportExcel(data, `fin-track-${todayISO()}.xlsx`)}><Download size={16} />Export .xlsx</Button>
      </Card>
      <Card title="Excel / CSV import">
        <p className="mb-3 text-sm text-muted">Use the column names from an export. Dates: YYYY-MM-DD or DD/MM/YYYY. A CSV is read as transactions.</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-72 max-w-full"><Select label="Import mode" value={mode} options={[MERGE, REPLACE]} onChange={setMode} /></div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium focus-within:outline-2">
            <Upload size={16} />Choose file
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onFile(file);
            }} />
          </label>
        </div>
        {message && <p role="status" className="mt-3 text-sm">{message}</p>}
        {!!errors.length && (
          <ul role="alert" className="mt-2 max-h-48 overflow-auto text-sm text-danger">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </Card>
      <Card title="OpenRouter (optional)">
        <p className="mb-3 text-sm text-muted">
          Adds an “AI parse” button to quick add. Only the line you type, today’s date and your account names are sent to OpenRouter.
          The key is stored unencrypted in this browser, so use one with a low spending limit. Everything else works without it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="API key"><input className="field" type="password" autoComplete="off" value={ai.apiKey} onChange={(e) => aiSettings.set({ ...ai, apiKey: e.target.value.trim() })} /></Field>
          <Field label="Model"><input className="field" value={ai.model} onChange={(e) => aiSettings.set({ ...ai, model: e.target.value.trim() })} /></Field>
        </div>
        {ai.apiKey && <div className="mt-3"><Button variant="danger" onClick={() => aiSettings.set({ ...ai, apiKey: '' })}>Remove key</Button></div>}
      </Card>
    </div>
  );
}
