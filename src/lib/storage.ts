import { useSyncExternalStore } from 'react';

export const PREFIX = 'fin_tracker_v1_';
type Listener = () => void;

let lastError = '';
const errorListeners = new Set<Listener>();
function report(message: string) {
  lastError = message;
  errorListeners.forEach((l) => l());
}
export const useStorageError = () =>
  useSyncExternalStore((l) => { errorListeners.add(l); return () => errorListeners.delete(l); }, () => lastError);

export interface Stored<T> {
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
  subscribe: (listener: Listener) => () => void;
}

/**
 * A localStorage-backed value. Writes are synchronous (nothing is lost on an immediate refresh),
 * other tabs stay in sync, and unreadable data is copied aside before anything can overwrite it.
 */
export function stored<T>(name: string, fallback: T, revive: (raw: unknown) => T): Stored<T> {
  const key = PREFIX + name;
  const listeners = new Set<Listener>();
  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
      return raw === null ? fallback : revive(JSON.parse(raw));
    } catch {
      if (raw !== null) {
        try { localStorage.setItem(`${key}_corrupt_${Date.now()}`, raw); } catch { /* storage full */ }
        report(`Saved ${name} could not be read. A backup copy was kept in browser storage.`);
      }
      return fallback;
    }
  };
  let value = read();
  const emit = () => listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key || e.key === null) { value = read(); emit(); }
    });
  }
  return {
    get: () => value,
    set: (next) => {
      value = typeof next === 'function' ? (next as (c: T) => T)(value) : next;
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch { report('Could not save: browser storage is full or blocked. Export to Excel now to keep your data.'); }
      emit();
    },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

export const useStored = <T>(s: Stored<T>): T => useSyncExternalStore(s.subscribe, s.get);
