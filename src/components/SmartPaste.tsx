import { useRef, useState } from 'react';
import { ClipboardPaste, Sparkles } from 'lucide-react';
import { todayISO } from '../lib/dates';
import { aiBatch, MAX_BATCH } from '../lib/openrouter';
import { redact } from '../lib/redact';
import { amountAppears, isNoise, parseSms, splitMessages } from '../lib/sms';
import { appendTransactions, flagDuplicates, type StatementRow } from '../lib/statement';
import { useStored } from '../lib/storage';
import { aiSettings, db, useData } from '../store';
import type { TransactionDraft } from '../types';
import { openAiSettings } from './OpenRouterModal';
import PreviewTable from './PreviewTable';
import { Button, Card } from './ui';

export default function SmartPaste() {
  const data = useData();
  const ai = useStored(aiSettings);
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [unread, setUnread] = useState<{ line: number; text: string }[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  // Bumped whenever the preview is replaced, so a late AI reply is discarded.
  const version = useRef(0);

  const reset = () => { version.current++; setRows([]); setUnread([]); setPicked({}); setBusy(false); };

  const read = () => {
    reset();
    const messages = splitMessages(pasted).filter((m) => !isNoise(m));
    const parsed: StatementRow[] = [], missed: { line: number; text: string }[] = [];
    messages.forEach((text, i) => {
      const draft = parseSms(text, data.rules, todayISO());
      if (draft) parsed.push({ line: i + 1, narration: text, draft });
      else missed.push({ line: i + 1, text });
    });
    setRows(parsed); setUnread(missed);
    setMessage(messages.length ? '' : 'No transaction alerts found.');
  };

  const needsAi = [
    ...unread.map((u) => ({ id: u.line, text: u.text })),
    ...rows.filter((r) => r.draft.category === 'Other').map((r) => ({ id: r.line, text: r.narration })),
  ];

  const askAi = async () => {
    const started = version.current;
    setBusy(true); setMessage('');
    try {
      const results = await aiBatch(needsAi, ai);
      if (started !== version.current) return;
      const byId = new Map(results.map((r) => [r.id, r]));
      // Locally read amount, date and merchant are kept; the model only classifies those rows.
      const updated = rows.map((r) => {
        const x = byId.get(r.line);
        return x && r.draft.category === 'Other'
          ? { ...r, draft: { ...r.draft, type: x.type, category: x.category, subCategory: x.subCategory, spendingNature: x.spendingNature } }
          : r;
      });
      const recovered: StatementRow[] = [], still: typeof unread = [];
      for (const u of unread) {
        const x = byId.get(u.line);
        if (x?.amount && x.merchant && amountAppears(u.text, x.amount)) {
          const draft: TransactionDraft = {
            date: x.date ?? todayISO(), type: x.type, amount: x.amount, merchant: x.merchant, category: x.category,
            subCategory: x.subCategory, spendingNature: x.spendingNature, account: 'Bank', isReimbursable: false,
          };
          recovered.push({ line: u.line, narration: u.text, draft });
        } else still.push(u);
      }
      setRows([...updated, ...recovered].sort((a, b) => a.line - b.line));
      setUnread(still);
      setMessage(`AI handled ${results.length} of ${needsAi.length} messages. Check them before importing.`);
    } catch (err) {
      if (started === version.current) setMessage(`AI request failed: ${err instanceof Error ? err.message : 'unknown error'}.`);
    } finally {
      if (started === version.current) setBusy(false);
    }
  };

  const statuses = flagDuplicates(rows, data.transactions);
  const included = rows.map((r, i) => picked[r.line] ?? statuses[i] !== 'Duplicate');
  const count = included.filter(Boolean).length;

  const commit = () => {
    db.transactions.set((list) => appendTransactions(list, rows.filter((_, i) => included[i]).map((r) => r.draft)));
    setMessage(`Imported ${count} transaction${count === 1 ? '' : 's'}.`);
    reset(); setPasted('');
  };

  return (
    <Card title="Smart paste (bank / UPI SMS)" action={<Button onClick={() => setOpen(!open)} aria-expanded={open}><ClipboardPaste size={14} />{open ? 'Hide' : 'Open'}</Button>}>
      {open && (
        <div className="space-y-3">
          <textarea className="field min-h-32" aria-label="SMS alerts" maxLength={20000} placeholder="Paste one or more alerts, one per line or separated by blank lines" value={pasted}
            onChange={(e) => { setPasted(e.target.value); reset(); setMessage(''); }} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={read} disabled={!pasted.trim()}>Read messages</Button>
            {!!needsAi.length && (ai.apiKey
              ? <Button onClick={askAi} disabled={busy || !navigator.onLine}><Sparkles size={14} />{busy ? 'Asking…' : `AI Categorize Unmatched (${Math.min(needsAi.length, MAX_BATCH)})`}</Button>
              : <Button onClick={openAiSettings}><Sparkles size={14} />Set up AI for {needsAi.length} unmatched</Button>)}
          </div>
          {!!needsAi.length && (
            <details className="text-sm text-muted">
              <summary>What AI would receive (numbers masked; names may remain)</summary>
              <ul className="max-h-32 overflow-auto">{needsAi.slice(0, MAX_BATCH).map((n) => <li key={n.id}>{redact(n.text, ai.privateWords)}</li>)}</ul>
            </details>
          )}
          {!!unread.length && <p className="text-sm text-warn">{unread.length} message(s) could not be read offline and are not in the preview.</p>}
          {message && <p role="status" className="text-sm">{message}</p>}
          {!!rows.length && (
            <>
              <PreviewTable rows={rows} statuses={statuses} included={included}
                onPick={(line, checked) => setPicked((p) => ({ ...p, [line]: checked }))}
                onEdit={(line, patch) => setRows((list) => list.map((r) => (r.line === line ? { ...r, draft: { ...r.draft, ...patch } } : r)))} />
              <div className="flex justify-end"><Button variant="primary" onClick={commit} disabled={!count || busy}>Import {count} transactions</Button></div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
