import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { eraseEverything, unlock } from '../lib/vault';
import { Button, Card } from './ui';

export default function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (await unlock(passphrase)) return onUnlocked();
      setError('Wrong passphrase.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock.');
    }
    setBusy(false);
  };

  const erase = () => {
    if (window.prompt('This permanently deletes all Fin Track data in this browser. Type ERASE to confirm.') !== 'ERASE') return;
    eraseEverything();
    window.location.reload();
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <Card title="Fin Track is locked">
        <form onSubmit={submit} className="space-y-3">
          <input className="field" type="password" aria-label="Passphrase" autoComplete="current-password" autoFocus required value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          <Button type="submit" variant="primary" disabled={busy} className="w-full"><Lock size={14} />{busy ? 'Unlocking…' : 'Unlock'}</Button>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
        <details className="mt-4 text-sm text-muted">
          <summary>Forgot the passphrase?</summary>
          <p className="my-2">It cannot be recovered. You can erase this browser’s data and restore from an Excel backup.</p>
          <Button variant="danger" onClick={erase}>Erase all data</Button>
        </details>
      </Card>
    </main>
  );
}
