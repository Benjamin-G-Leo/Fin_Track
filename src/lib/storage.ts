import { useSyncExternalStore } from 'react';
import { isStale, PREFIX, read as readRaw, write as writeRaw } from './vault';

export { PREFIX };
type Listener = () => void;

let lastError = '';
const errorListeners = new Set<Listener>();
function report(message: string) {
  lastError = message;
  errorListeners.forEach((l) => l());
}
export const useStorageError = () =>
  useSyncExternalStore((l) => { errorListeners.add(l); return () => errorListeners.delete(l); }, () => lastError);

/** Thrown by a reviver that could rescue part of the data. */
export class Salvaged extends Error {
  constructor(readonly value: unknown, readonly dropped: number) { super('partly invalid data'); }
}

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
      raw = readRaw(key);
      return raw === null ? fallback : revive(JSON.parse(raw));
    } catch (err) {
      if (raw === null) {
        let exists = false;
        try { exists = localStorage.getItem(key) !== null; } catch { /* storage unavailable */ }
        if (exists) report(`Saved ${name} could not be decrypted.`);
        return fallback;
      }
      let backedUp = false;
      try { writeRaw(`${key}_corrupt_${Date.now()}`, raw); backedUp = true; } catch { /* storage full */ }
      const kept = backedUp ? ' A backup copy was kept in browser storage.' : '';
      if (!(err instanceof Salvaged)) {
        report(`Saved ${name} could not be read.${kept}`);
        return fallback;
      }
      report(`${err.dropped} unreadable record(s) in ${name} were skipped; the rest are shown.${kept}`);
      // Save the cleaned list only once the original is safely copied.
      if (backedUp) {
        try { writeRaw(key, JSON.stringify(err.value)); } catch { /* keep the original */ }
      }
      return err.value as T;
    }
  };
  let value = read();
  const emit = () => listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if ((e.key === key || e.key === null) && !isStale()) { value = read(); emit(); }
    });
  }
  return {
    get: () => value,
    set: (next) => {
      value = typeof next === 'function' ? (next as (c: T) => T)(value) : next;
      try { writeRaw(key, JSON.stringify(value)); }
      catch { report('Could not save: browser storage is full or blocked, or the app lock changed in another tab. Export to Excel now, then reload.'); }
      emit();
    },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

export const useStored = <T>(s: Stored<T>): T => useSyncExternalStore(s.subscribe, s.get);
