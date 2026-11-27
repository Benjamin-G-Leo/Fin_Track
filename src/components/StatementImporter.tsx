import { useRef, useState } from 'react';
import { Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { FileLimit, readFile } from '../lib/excel';
import { aiBatch, MAX_BATCH } from '../lib/openrouter';
import { redact } from '../lib/redact';
import {
  appendTransactions, BANK_PRESETS, detectPreset, FIELDS, findHeaderRow, flagDuplicates, mapColumns,
  parseStatement, toGrid, type Field as Column, type Grid, type Mapping, type Preset,
} from '../lib/statement';
import { useStored } from '../lib/storage';
import { aiSettings, db, importPresets, knownAccounts, useData } from '../store';
import type { TransactionDraft } from '../types';
import { openAiSettings } from './OpenRouterModal';
import PreviewTable from './PreviewTable';
import { Button, Card, Field, Select } from './ui';

const LABELS: Record<Column, string> = { date: 'Date', narration: 'Narration', debit: 'Debit', credit: 'Credit', account: 'Account (optional)' };
const AUTO = 'Auto-detect';

export default function StatementImporter() {
  const data = useData();
  const custom = useStored(importPresets);
  const presets = [...custom, ...BANK_PRESETS.filter((b) => !custom.some((c) => c.name === b.name))];
  const [grid, setGrid] = useState<Grid | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [presetName, setPresetName] = useState(AUTO);
  const [saveName, setSaveName] = useState('');
  // Per-row choices, keyed by spreadsheet row so they survive re-parsing.
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [edits, setEdits] = useState<Record<number, Partial<TransactionDraft>>>({});
  const [message, setMessage] = useState('');

  const ai = useStored(aiSettings);
  const [busy, setBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  // Bumped whenever the mapping or file changes, so a late AI reply is discarded.
  const version = useRef(0);

  const resetChoices = () => { version.current++; setPicked({}); setEdits({}); setBusy(false); setAiMessage(''); };
  const remap = (next: Mapping) => { setMapping(next); resetChoices(); };

  const applyPreset = (source: Grid, name: string, headerRow = findHeaderRow(source)) => {
    const header = source[headerRow] ?? [];
    const chosen = name === AUTO ? detectPreset(header, presets) : presets.find((p) => p.name === name);
    setPresetName(chosen?.name ?? AUTO);
    remap({ headerRow, columns: mapColumns(header, chosen), accountName: chosen?.accountName ?? '' });
  };

  const onFile = async (file: File) => {
    setMessage('');
    try {
      const next = toGrid(await readFile(file));
      if (!next.length) throw new Error('empty');
      setGrid(next); setFileName(file.name); applyPreset(next, AUTO);
    } catch (err) {
      setGrid(null); setMapping(null); setMessage(err instanceof FileLimit ? err.message : 'That file could not be read as a spreadsheet.');
    }
  };

  const close = () => { setGrid(null); setMapping(null); resetChoices(); };
  const header = grid && mapping ? (grid[mapping.headerRow] ?? []) : [];
  const width = grid ? grid.reduce((m, r) => Math.max(m, r.length), 0) : 0;
  const columnNames = Array.from({ length: width }, (_, i) => String(header[i] ?? '').trim() || `Column ${i + 1}`);
  const ready = !!mapping && mapping.columns.date >= 0 && mapping.columns.narration >= 0
    && (mapping.columns.debit >= 0 || mapping.columns.credit >= 0);
  const parsed = grid && mapping && ready ? parseStatement(grid, mapping, data.rules) : null;
  const rows = parsed?.rows.map((r) => ({ ...r, draft: { ...r.draft, ...edits[r.line] } })) ?? [];
  const statuses = flagDuplicates(rows, data.transactions);
  const included = rows.map((r, i) => picked[r.line] ?? statuses[i] !== 'Duplicate');
  const count = included.filter(Boolean).length;

  const edit = (line: number, patch: Partial<TransactionDraft>) => setEdits((e) => ({ ...e, [line]: { ...e[line], ...patch } }));

  // Rows still in "Other" that you have not set yourself and that would be imported.
  const unmatched = rows.filter((r, i) => included[i] && r.draft.category === 'Other' && !edits[r.line]?.category);

  const askAi = async () => {
    const started = version.current;
    setBusy(true); setAiMessage('');
    try {
      const results = await aiBatch(unmatched.map((r) => ({
        id: r.line, text: r.narration, direction: r.draft.type === 'Income' ? 'credit' : 'debit',
      })), ai);
      if (started !== version.current) return;
      // Merchant, date and amount stay as read, so duplicate detection is unaffected.
      for (const x of results) {
        edit(x.id, { type: x.type, category: x.category, subCategory: x.subCategory, spendingNature: x.spendingNature });
      }
      setAiMessage(`AI categorised ${results.length} of ${unmatched.length} rows. Check them before importing.`);
    } catch (err) {
      if (started === version.current) setAiMessage(`AI request failed: ${err instanceof Error ? err.message : 'unknown error'}.`);
    } finally {
      if (started === version.current) setBusy(false);
    }
  };

  const savePreset = () => {
    const name = saveName.trim();
    if (!name || !mapping) return;
    const columns = Object.fromEntries(FIELDS.map((f) => [f, mapping.columns[f] >= 0 ? columnNames[mapping.columns[f]]! : ''])) as Preset['columns'];
    importPresets.set((list) => [{ name, columns, accountName: mapping.accountName }, ...list.filter((p) => p.name !== name)]);
    setPresetName(name); setSaveName('');
  };

  const commit = () => {
    const drafts = rows.filter((_, i) => included[i]).map((r) => r.draft);
    db.transactions.set((list) => appendTransactions(list, drafts));
    setMessage(`Imported ${drafts.length} transaction${drafts.length === 1 ? '' : 's'}, left out ${rows.length - drafts.length}.`);
    close();
  };

  return (
    <Card title="Import bank statement">
      <p className="mb-3 text-sm text-muted">Upload an .xlsx, .xls or .csv statement, check the column mapping, then review every row before importing. Dates are read day-first.</p>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium focus-within:outline-2">
        <Upload size={16} />Choose statement
        <input type="file" aria-label="Bank statement file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }} />
      </label>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}

      {grid && mapping && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <p className="text-sm font-medium break-all">{fileName}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Preset"><Select value={presetName} options={[AUTO, ...presets.map((p) => p.name)]} onChange={(n) => applyPreset(grid, n, mapping.headerRow)} /></Field>
            <Field label="Header row number">
              <input className="field" type="number" min={1} max={grid.length} value={mapping.headerRow + 1}
                onChange={(e) => applyPreset(grid, presetName, Math.min(grid.length, Math.max(1, Number(e.target.value) || 1)) - 1)} />
            </Field>
            {FIELDS.map((f) => (
              <Field key={f} label={LABELS[f]}>
                <select className="field" value={mapping.columns[f]} onChange={(e) => remap({ ...mapping, columns: { ...mapping.columns, [f]: Number(e.target.value) } })}>
                  <option value={-1}>Not mapped</option>
                  {columnNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
                </select>
              </Field>
            ))}
            <Field label="Account name (if no column)">
              <input className="field" list="import-accounts" value={mapping.accountName} onChange={(e) => remap({ ...mapping, accountName: e.target.value })} />
              <datalist id="import-accounts">{knownAccounts(data).map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field !w-56" aria-label="Preset name" placeholder="Name this mapping" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <Button onClick={savePreset} disabled={!saveName.trim()}><Save size={14} />Save preset</Button>
            {custom.some((p) => p.name === presetName) && (
              <Button variant="danger" onClick={() => { importPresets.set((l) => l.filter((p) => p.name !== presetName)); setPresetName(AUTO); }}><Trash2 size={14} />Delete preset</Button>
            )}
          </div>

          {!ready && <p role="alert" className="text-sm text-warn">Map Date, Narration and at least one of Debit or Credit to see the preview.</p>}
          {parsed && (
            <>
              <p className="text-sm">
                Rows: {rows.length} · Duplicates: {statuses.filter((s) => s === 'Duplicate').length} · Selected: {count} · Unreadable: {parsed.skipped.length}
              </p>
              {!!parsed.skipped.length && (
                <details className="text-sm text-muted">
                  <summary>Rows that will not be imported</summary>
                  <ul className="max-h-32 overflow-auto">{parsed.skipped.map((s) => <li key={s}>{s}</li>)}</ul>
                </details>
              )}
              {!!rows.length && (
                <PreviewTable rows={rows} statuses={statuses} included={included}
                  onPick={(line, checked) => setPicked((p) => ({ ...p, [line]: checked }))} onEdit={edit} />
              )}
              {!!unmatched.length && (
                <div className="space-y-1">
                  {ai.apiKey
                    ? <Button onClick={askAi} disabled={busy || !navigator.onLine}><Sparkles size={14} />{busy ? 'Asking…' : `AI Categorize Unmatched (${Math.min(unmatched.length, MAX_BATCH)})`}</Button>
                    : <Button onClick={openAiSettings}><Sparkles size={14} />Set up AI for {unmatched.length} unmatched</Button>}
                  <details className="text-xs text-muted">
                    <summary>What would be sent (with debit or credit). Names may remain; add them to “Always hide” in AI settings.</summary>
                    <ul className="max-h-32 overflow-auto">{unmatched.slice(0, MAX_BATCH).map((r) => <li key={r.line}>{redact(r.narration, ai.privateWords)}</li>)}</ul>
                  </details>
                </div>
              )}
              {aiMessage && <p role="status" className="text-sm">{aiMessage}</p>}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={commit} disabled={!count || busy}>Import {count} transactions</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
