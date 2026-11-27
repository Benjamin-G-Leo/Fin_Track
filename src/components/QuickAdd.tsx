import { useState, type FormEvent } from 'react';
import { Plus, Sparkles, Upload, Zap } from 'lucide-react';
import { todayISO, dateLabel } from '../lib/dates';
import { formatINR } from '../lib/format';
import { aiParse } from '../lib/openrouter';
import { parseQuickAdd } from '../lib/quickAdd';
import { useStored } from '../lib/storage';
import { aiSettings, knownAccounts, useData } from '../store';
import type { TransactionDraft } from '../types';
import TransactionForm, { saveTransaction } from './TransactionForm';
import { Button, Card } from './ui';

export default function QuickAdd() {
  const data = useData();
  const ai = useStored(aiSettings);
  const [line, setLine] = useState('');
  const [aiDraft, setAiDraft] = useState<TransactionDraft | null>(null);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const preview = line.trim() ? parseQuickAdd(line, data.rules, knownAccounts(data)) : null;

  const reset = (done = '') => { setLine(''); setAiDraft(null); setMessage(done); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!preview) return setMessage('Include an amount, for example "450 swiggy".');
    if (saveTransaction(preview)) reset(`Added ${formatINR(preview.amount)} · ${preview.merchant}`);
  };

  const askAi = async () => {
    setBusy(true); setMessage('');
    try { setAiDraft(await aiParse(line, knownAccounts(data), todayISO(), ai)); }
    catch (err) { setMessage(`AI parse failed (${err instanceof Error ? err.message : 'unknown error'}). The offline parser still works.`); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Quick add" action={
      <span className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => { window.location.hash = 'data'; }}><Upload size={16} />Import statement</Button>
        <Button onClick={() => { setManual(!manual); setAiDraft(null); }}><Plus size={16} />Manual entry</Button>
      </span>}>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className="field !w-auto min-w-0 flex-1 basis-56" aria-label="Quick add" maxLength={300} placeholder='e.g. "450 swiggy hdfc upi yesterday"'
          value={line} onChange={(e) => { setLine(e.target.value); setAiDraft(null); setMessage(''); }} />
        <Button type="submit" variant="primary"><Zap size={16} />Add</Button>
        {ai.apiKey && <Button onClick={askAi} disabled={busy || !line.trim() || !navigator.onLine}><Sparkles size={16} />{busy ? 'Asking…' : 'AI parse'}</Button>}
      </form>
      {preview && !aiDraft && (
        <p className="mt-2 text-sm text-muted">
          {preview.type} · <strong className="text-ink">{formatINR(preview.amount)}</strong> · {preview.merchant} · {preview.category} · {preview.account} · {dateLabel(preview.date)}
          {preview.isReimbursable && ' · Reimbursable'}
        </p>
      )}
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
      {(aiDraft || manual) && (
        <div className="mt-4 border-t border-line pt-4">
          {aiDraft && <p className="mb-2 text-sm text-muted">Check the AI suggestion before saving.</p>}
          <TransactionForm key={aiDraft ? JSON.stringify(aiDraft) : 'manual'} initial={aiDraft ?? undefined}
            onDone={() => { if (aiDraft) reset(); setManual(false); }} />
        </div>
      )}
    </Card>
  );
}
