import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { disableLock, enableLock, isLockEnabled, MIN_PASSPHRASE } from '../lib/vault';
import { Button, Card } from './ui';

export default function AppLock() {
  const [on, setOn] = useState(isLockEnabled);
  const [passphrase, setPassphrase] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!on && passphrase !== repeat) return setMessage('The passphrases do not match.');
    setBusy(true);
    try {
      if (on) {
        if (!(await disableLock(passphrase))) setMessage('Wrong passphrase.');
        else { setOn(false); setMessage('Lock removed. Data is stored unencrypted again.'); setPassphrase(''); }
      } else {
        await enableLock(passphrase);
        setOn(true); setMessage('Lock on. Data in this browser is now encrypted.'); setPassphrase(''); setRepeat('');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not change the lock.');
    }
    setBusy(false);
  };

  return (
    <Card title="App lock (encryption)">
      <p className="mb-3 text-sm text-muted">
        Encrypts your records and API key in this browser. The app asks for the passphrase on opening and locks after 10 idle minutes.
        <strong className="text-warn"> A forgotten passphrase cannot be recovered</strong>, so export a full backup first. Exported files are not encrypted.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input className="field !w-56" type="password" aria-label="Passphrase" placeholder={on ? 'Current passphrase' : `New passphrase (${MIN_PASSPHRASE}+ characters)`}
          autoComplete={on ? 'current-password' : 'new-password'} required minLength={on ? undefined : MIN_PASSPHRASE} value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        {!on && <input className="field !w-56" type="password" aria-label="Repeat passphrase" placeholder="Repeat passphrase" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
        <Button type="submit" variant={on ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Working…' : on ? 'Remove lock' : 'Turn on lock'}</Button>
        {on && <Button onClick={() => window.location.reload()}><Lock size={14} />Lock now</Button>}
      </form>
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
    </Card>
  );
}
