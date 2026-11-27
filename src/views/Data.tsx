import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, Card, Select } from '../components/ui';
import { todayISO } from '../lib/dates';
import { applyImport, FileLimit, exportCsv, exportExcel, importExcel } from '../lib/excel';
import { mergeTransactions } from '../lib/ids';
import AppLock from '../components/AppLock';
import { openAiSettings } from '../components/OpenRouterModal';
import SampleControls from '../components/SampleControls';
import StatementImporter from '../components/StatementImporter';
import { commit, useData } from '../store';

const MERGE = 'Merge with current data';
const REPLACE = 'Replace sheets found in the file';

export default function DataView() {
  const data = useData();
  const [mode, setMode] = useState(MERGE);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

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
    } catch (err) {
      setMessage(err instanceof FileLimit ? err.message : 'That file could not be read as a spreadsheet.');
    }
  };

  return (
    <div className="space-y-4">
      <StatementImporter />
      <Card title="Sample data">
        <SampleControls />
      </Card>
      <AppLock />
      <Card title="Excel export">
        <p className="mb-3 text-sm text-muted">
          The report has Transactions, Monthly Summary, Recurring Bills and Savings Goals. The full backup also holds Budgets and Keyword Rules,
          so use it to protect your data. Your API key is never exported.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => exportExcel(data, `fin-track-${todayISO()}.xlsx`)}><Download size={16} />Export .xlsx</Button>
          <Button onClick={() => exportExcel(data, `fin-track-backup-${todayISO()}.xlsx`, true)}><Download size={16} />Full backup</Button>
          <Button onClick={() => exportCsv(data, `fin-track-transactions-${todayISO()}.csv`)}><Download size={16} />Transactions .csv</Button>
        </div>
      </Card>
      <Card title="Restore from a Fin Track file">
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
        <p className="mb-3 text-sm text-muted">AI parse, SMS cleanup and monthly insights. Everything else works without it.</p>
        <Button onClick={openAiSettings}>AI settings</Button>
      </Card>
    </div>
  );
}
