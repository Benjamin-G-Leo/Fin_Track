import { CATEGORIES, SPENDING_NATURES, TRANSACTION_TYPES, type TransactionDraft } from '../types';
import type { AiSettings } from '../store';
import { parseTransaction, type Row } from './validate';

/**
 * Optional enhancement. Sends only the typed line, today's date and account names to OpenRouter.
 */
export async function aiParse(line: string, accounts: string[], today: string, settings: AiSettings): Promise<TransactionDraft> {
  const system = [
    'Convert one personal-finance note (currency INR) into a JSON object and reply with JSON only.',
    'Keys: date (YYYY-MM-DD), type, amount (positive number), category, subCategory, spendingNature, account, merchant, isReimbursable.',
    `type: ${TRANSACTION_TYPES.join(' | ')}. category: ${CATEGORIES.join(' | ')}. spendingNature: ${SPENDING_NATURES.join(' | ')}.`,
    `Known accounts: ${accounts.join(', ')}. Today is ${today}.`,
  ].join('\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0,
      messages: [{ role: 'system', content: system }, { role: 'user', content: line }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const json = /\{[\s\S]*\}/.exec(body.choices?.[0]?.message?.content ?? '')?.[0];
  if (!json) throw new Error('The model did not return JSON');
  const result = parseTransaction(JSON.parse(json) as Row);
  if (!result.ok) throw new Error(`Model reply rejected: ${result.error}`);
  return result.value;
}
