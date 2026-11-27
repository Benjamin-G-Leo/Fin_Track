/**
 * Optional at-rest encryption for everything the app keeps in localStorage (AES-256-GCM, key from a
 * passphrase via PBKDF2). The cipher is synchronous so saves still happen immediately. The key lives
 * only in memory. This does not protect against code running in the page while it is unlocked.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';

export const PREFIX = 'fin_tracker_v1_';
const META = `${PREFIX}vault`;
const MARK = 'enc1:';
const ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 10;

interface Meta { v: 1; salt: string; iterations: number; check: string }

let key: Uint8Array | null = null;
let activeSalt = '';

const b64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);

async function derive(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('Encryption needs HTTPS or localhost.');
  const material = await crypto.subtle.importKey('raw', utf8(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, material, 256);
  return new Uint8Array(bits);
}

// The storage key name is authenticated too, so one encrypted value cannot be swapped for another.
function seal(withKey: Uint8Array, name: string, plain: string): string {
  const nonce = randomBytes(12);
  const body = gcm(withKey, nonce, utf8(name)).encrypt(utf8(plain));
  const out = new Uint8Array(nonce.length + body.length);
  out.set(nonce);
  out.set(body, nonce.length);
  return MARK + b64(out);
}

function open(withKey: Uint8Array, name: string, stored: string): string {
  const bytes = unb64(stored.slice(MARK.length));
  return new TextDecoder().decode(gcm(withKey, bytes.subarray(0, 12), utf8(name)).decrypt(bytes.subarray(12)));
}

function meta(): Meta | null {
  const raw = localStorage.getItem(META);
  return raw === null ? null : (JSON.parse(raw) as Meta);
}

export function isLockEnabled(): boolean {
  try { return localStorage.getItem(META) !== null; } catch { return false; }
}

/** True when another tab changed the lock, so this tab must not read or write until it reloads. */
export function isStale(): boolean {
  const m = meta();
  return m ? !key || m.salt !== activeSalt : !!key;
}

export function read(name: string): string | null {
  const stored = localStorage.getItem(name);
  if (stored === null || !stored.startsWith(MARK)) return stored;
  if (!key) throw new Error('locked');
  return open(key, name, stored);
}

export function write(name: string, plain: string): void {
  if (isStale()) throw new Error('lock changed in another tab');
  localStorage.setItem(name, key ? seal(key, name, plain) : plain);
}

const dataKeys = () => Object.keys(localStorage).filter((k) => k.startsWith(PREFIX) && k !== META);

export async function unlock(passphrase: string): Promise<boolean> {
  const m = meta();
  if (!m) return true;
  const candidate = await derive(passphrase, unb64(m.salt), m.iterations);
  try { open(candidate, META, m.check); } catch { return false; }
  key = candidate;
  activeSalt = m.salt;
  return true;
}

export async function enableLock(passphrase: string): Promise<void> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Use at least ${MIN_PASSPHRASE} characters.`);
  if (isLockEnabled()) throw new Error('The lock is already on.');
  const salt = randomBytes(16);
  const next = await derive(passphrase, salt, ITERATIONS);
  const before = dataKeys().map((k) => [k, localStorage.getItem(k)!] as const);
  const m: Meta = { v: 1, salt: b64(salt), iterations: ITERATIONS, check: seal(next, META, 'ok') };
  try {
    // The salt is saved first, so nothing is ever encrypted without the means to recover it.
    localStorage.setItem(META, JSON.stringify(m));
    for (const [k, v] of before) localStorage.setItem(k, seal(next, k, v));
  } catch {
    for (const [k, v] of before) localStorage.setItem(k, v);
    localStorage.removeItem(META);
    throw new Error('Not enough browser storage to encrypt. Nothing was changed.');
  }
  key = next;
  activeSalt = m.salt;
}

export async function disableLock(passphrase: string): Promise<boolean> {
  if (!(await unlock(passphrase))) return false;
  // Decrypt everything before writing anything; the salt is removed last.
  const plain = dataKeys().map((k) => [k, read(k)!] as const);
  for (const [k, v] of plain) localStorage.setItem(k, v);
  localStorage.removeItem(META);
  key = null;
  activeSalt = '';
  return true;
}

/** For a forgotten passphrase: removes all app data so the app can start again. */
export function eraseEverything(): void {
  [...dataKeys(), META].forEach((k) => localStorage.removeItem(k));
  key = null;
  activeSalt = '';
}

/** Drops the in-memory key, for tests; the app locks by reloading the page. */
export const forgetKey = (): void => { key = null; activeSalt = ''; };

export const isLockKey = (name: string | null): boolean => name === META;
