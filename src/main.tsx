import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Unlock from './components/Unlock';
import { isLockEnabled, isLockKey } from './lib/vault';
import './index.css';

const root = createRoot(document.getElementById('root')!);
const IDLE_LIMIT = 10 * 60_000;

// Reloading drops the in-memory key. Applies whenever a lock is on.
let lastActive = Date.now();
const idleTooLong = () => isLockEnabled() && Date.now() - lastActive > IDLE_LIMIT;
const touch = () => { if (idleTooLong()) window.location.reload(); else lastActive = Date.now(); };

/** The store reads storage as soon as it loads, so it is imported only after unlocking. */
async function start() {
  const [{ default: App }, { seedOnFirstRun }] = await Promise.all([import('./App'), import('./store')]);
  seedOnFirstRun();
  root.render(<StrictMode><App /></StrictMode>);
  lastActive = Date.now();
  ['pointerdown', 'keydown'].forEach((e) => window.addEventListener(e, touch));
  window.setInterval(() => { if (idleTooLong()) window.location.reload(); }, 15_000);
}

// Turning the lock on or off in another tab makes this tab's view of storage wrong.
window.addEventListener('storage', (e) => { if (isLockKey(e.key)) window.location.reload(); });

if (isLockEnabled()) root.render(<StrictMode><Unlock onUnlocked={() => void start()} /></StrictMode>);
else void start();
