import { useEffect, useRef, useState, type FormEvent } from 'react';
import { KeyRound, Trash2, X } from 'lucide-react';
import { DEFAULT_MODEL, isFreeModel, MODEL_CHOICES } from '../lib/openrouter';
import { useStored } from '../lib/storage';
import { aiSettings, clearAiKey } from '../store';
import { Button, Field } from './ui';

const OPEN = 'fin-track:ai-settings';
const CUSTOM = 'Custom…';
export const openAiSettings = () => window.dispatchEvent(new Event(OPEN));

export default function OpenRouterModal() {
  const saved = useStored(aiSettings);
  const dialog = useRef<HTMLDialogElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(saved.model);
  const [custom, setCustom] = useState(false);
  const [message, setMessage] = useState('');
  const [deny, setDeny] = useState(true);
  const [words, setWords] = useState('');

  useEffect(() => {
    const open = () => {
      const current = aiSettings.get();
      setApiKey(''); setModel(current.model); setCustom(!MODEL_CHOICES.includes(current.model)); setMessage('');
      setDeny(current.denyDataCollection !== false); setWords(current.privateWords ?? '');
      dialog.current?.showModal();
    };
    window.addEventListener(OPEN, open);
    return () => window.removeEventListener(OPEN, open);
  }, []);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!isFreeModel(model.trim() || DEFAULT_MODEL)) return setMessage('Only free models are allowed: the ID must end in ":free".');
    aiSettings.set({ apiKey: apiKey.trim() || saved.apiKey, model: model.trim() || DEFAULT_MODEL, denyDataCollection: deny, privateWords: words });
    setApiKey(''); setMessage('Saved in this browser.');
  };

  return (
    <dialog ref={dialog} aria-labelledby="ai-title" className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-line bg-surface p-4 text-ink backdrop:bg-black/50">
      <header className="mb-2 flex items-center justify-between">
        <h2 id="ai-title" className="flex items-center gap-2 font-semibold"><KeyRound size={16} />AI settings (OpenRouter)</h2>
        <Button aria-label="Close" onClick={() => dialog.current?.close()}><X size={14} /></Button>
      </header>
      <p className="mb-3 text-sm text-muted">
        Optional, and uses free models only. Your key and settings are kept only in this browser’s localStorage (encrypted if you turn on the app lock), and the key is sent only to openrouter.ai.
        Use a key with a low spending limit.
      </p>
      <form onSubmit={save} className="space-y-3">
        <Field label={saved.apiKey ? `API key (saved, ends …${saved.apiKey.slice(-4)})` : 'API key'}>
          <input className="field" type="password" autoComplete="off" placeholder={saved.apiKey ? 'Leave blank to keep' : 'sk-or-…'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </Field>
        <Field label="Model">
          <select className="field" value={custom ? CUSTOM : model} onChange={(e) => {
            const next = e.target.value;
            setCustom(next === CUSTOM);
            if (next !== CUSTOM) setModel(next);
          }}>
            {[...MODEL_CHOICES, CUSTOM].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        {custom && <Field label="Model ID (free only, ends in :free)"><input className="field" value={model} onChange={(e) => setModel(e.target.value)} /></Field>}
        <Field label="Always hide these words (comma separated)">
          <input className="field" placeholder="e.g. your name, family names, employer" value={words} onChange={(e) => setWords(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={deny} onChange={(e) => setDeny(e.target.checked)} />
          Only use providers that do not store prompts
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="danger" disabled={!saved.apiKey} onClick={() => { clearAiKey(); setApiKey(''); setMessage('Key cleared.'); }}><Trash2 size={14} />Clear Key</Button>
          <Button type="submit" variant="primary">Save</Button>
        </div>
        {message && <p role="status" className="text-sm">{message}</p>}
      </form>
    </dialog>
  );
}
