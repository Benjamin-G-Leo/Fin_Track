import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { categoryVsBudget } from '../lib/analytics';
import { monthLabel } from '../lib/dates';
import { aiInsights, auditPayload, type Recommendation } from '../lib/openrouter';
import { useStored } from '../lib/storage';
import { aiSettings, useData } from '../store';
import { openAiSettings } from './OpenRouterModal';
import { Button, Card } from './ui';

/** Mounted with key={month}, so results never carry over to another month. */
export default function Insights({ month }: { month: string }) {
  const { transactions, budgets } = useData();
  const ai = useStored(aiSettings);
  const [list, setList] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const payload = auditPayload(month, categoryVsBudget(transactions, budgets, month));
  const hasSpend = payload.categories.some((c) => c.spent > 0);

  const generate = async () => {
    if (!ai.apiKey) return openAiSettings();
    setBusy(true); setError('');
    try { setList(await aiInsights(payload, ai)); }
    catch (err) { setError(`Could not generate insights: ${err instanceof Error ? err.message : 'unknown error'}.`); }
    finally { setBusy(false); }
  };

  return (
    <Card title={`Monthly audit · ${monthLabel(month)}`} action={<Button onClick={generate} disabled={busy || !hasSpend}><Sparkles size={14} />{busy ? 'Thinking…' : 'Generate AI Insights'}</Button>}>
      <p className="text-sm text-muted">Optional. Sends only the month, category totals and budget limits. No merchants, accounts or individual transactions.</p>
      <details className="mt-1 text-xs text-muted">
        <summary>See exactly what is sent</summary>
        <pre className="max-h-40 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
      </details>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {!!list.length && (
        <>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {list.map((r, i) => <li key={i}><strong>{r.title}</strong><span className="block">{r.detail}</span></li>)}
          </ol>
          <p className="mt-2 text-xs text-muted">AI-generated from the totals as they were when you clicked. Check before acting.</p>
        </>
      )}
    </Card>
  );
}
