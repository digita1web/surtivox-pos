/**
 * Cliente de sincronización con un backend opcional. La base SQLite local es la
 * fuente de verdad; si se configura un servidor, la app reconcilia cambios en
 * segundo plano.
 *
 * - PUSH: envía cambios locales desde el último cursor.
 * - PULL: descarga los cambios de la tienda y los aplica localmente.
 *
 * Los cursores conservan un solapamiento de seguridad para tolerar desfases
 * breves entre relojes sin perder filas.
 */
import {
  SYNC_TABLES, upsertSql, rowValues, changedSinceSql, stripLocalOnly, chunkPushRows, type PushTableRows,
} from '@surtivox/database';
import * as Crypto from 'expo-crypto';
import { getDb } from './db';
import { getStore } from './repos';
import { writeSafetyBackup } from './backup';
import { disconnectOn, reusableToken } from './syncState';
import { SyncHttpError, KEY_CHANGED_MESSAGE, toSyncHttpError } from './syncErrors';
import {
  startKitOn, loadKitOn, confirmKitOn, rotateKitOn, hasPendingRotationOn, recoverFromKitOn, kitStatusOn, isKitToken,
  readKitReminderInputOn, shouldRemindKit, kitReminderText, snoozeKitReminderOn,
  type KitDeps, type KitInfo, type KitStatus,
} from './kitOps';
import { NUMBERED_TABLES, resolveNumberCollision } from './numberCollision';

const OVERLAP_MS = 30_000;

/**
 * URL del Worker de sincronización configurado para esta compilación.
 * Vacío deja solo el flujo manual con URL y token.
 */
export const DEFAULT_SYNC_URL = 'https://surtivox-sync.surtivox.workers.dev';

/** True when this build ships a hosted backend, so the one-tap flow is offered. */
export function hasHostedSync(): boolean { return DEFAULT_SYNC_URL.trim().length > 0; }

// Crockford-ish base32 with ambiguous characters (0/O, 1/I/L) removed, so a
// shop code is easy to read aloud and type on a second device.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * A shop's sync secret: shown to the user as a shareable code and sent to the
 * server as the bearer token. Stored without dashes; displayed grouped.
 * 16 chars over a 32-symbol alphabet = 80 bits drawn from a cryptographically
 * secure RNG (expo-crypto). 256 is a multiple of 32, so (byte % 32) is bias-free.
 */
export function newShopCode(): string {
  const bytes = Crypto.getRandomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return s;
}

/** Strip spaces/dashes and upper-case, so both devices send the same token. */
export function normalizeCode(code: string): string {
  return code.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

/** Group a stored token into XXXX-XXXX… for display. */
export function formatCode(token: string): string {
  return normalizeCode(token).match(/.{1,4}/g)?.join('-') ?? token;
}

export interface SyncState {
  server_url: string | null;
  token: string | null;
  last_pushed_at: number;
  last_pulled_at: number;
  last_synced_at: number | null;
}

export async function getSyncState(): Promise<SyncState> {
  const row = await getDb().getFirstAsync<SyncState>('SELECT server_url, token, last_pushed_at, last_pulled_at, last_synced_at FROM sync_state WHERE id = 1');
  return row ?? { server_url: null, token: null, last_pushed_at: 0, last_pulled_at: 0, last_synced_at: null };
}

export function isConfigured(s: SyncState): boolean {
  return !!(s.server_url && s.token);
}

export async function saveSyncConfig(serverUrl: string, token: string): Promise<void> {
  const url = serverUrl.trim().replace(/\/+$/, '');
  await getDb().runAsync('UPDATE sync_state SET server_url = ?, token = ? WHERE id = 1', [url, token.trim()]);
}

export async function disconnectSync(): Promise<void> {
  await disconnectOn(getDb());
}

async function api(base: string, path: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  if (!res.ok) throw toSyncHttpError(body, res.status, res.headers.get('retry-after'));
  return body;
}

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(new ArrayBuffer(data.length));
  input.set(data);
  return new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input));
}

function kitDeps(base: string): KitDeps {
  return {
    randomBytes: (length) => Crypto.getRandomBytes(length),
    sha256: sha256Bytes,
    now: () => Date.now(),
    request: (path, token, body) => api(base, path, token, { method: 'POST', body: JSON.stringify(body) }),
    isDefinitiveRefusal: (error) => error instanceof SyncHttpError && error.status >= 400 && error.status < 500 && error.status !== 429,
  };
}

/** Bind this store to the token on the server (idempotent). */
async function register(base: string, token: string, storeId: string): Promise<void> {
  await api(base, '/sync/register', token, { method: 'POST', body: JSON.stringify({ storeId }) });
}

async function pushChanges(base: string, token: string, since: number): Promise<number> {
  const db = getDb();
  const collected: PushTableRows[] = [];
  let maxTime = since;
  const from = Math.max(0, since - OVERLAP_MS);
  for (const t of SYNC_TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(changedSinceSql(t), [from]);
    if (rows.length === 0) continue;
    collected.push({ name: t.name, rows: rows.map((r) => stripLocalOnly(t, r)) });
    for (const r of rows) {
      const ts = Number(r[t.timeColumn]);
      if (Number.isFinite(ts) && ts > maxTime) maxTime = ts;
    }
  }
  const batches = chunkPushRows(collected);
  if (batches.length === 0) return since;
  for (const tables of batches) {
    await api(base, '/sync/push', token, { method: 'POST', body: JSON.stringify({ tables }) });
  }
  return maxTime;
}

/** Apply a server pull payload locally (FK off; parents-before-children order). */
async function applyPull(payload: { tables: Record<string, Record<string, unknown>[]> }): Promise<number> {
  const db = getDb();
  let applied = 0;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const t of SYNC_TABLES) {
        const rows = payload.tables[t.name];
        if (!Array.isArray(rows)) continue;
        const sql = upsertSql(t);
        const numbered = NUMBERED_TABLES.find((n) => n.table === t.name);
        for (const row of rows) {
          if (numbered) await resolveNumberCollision(db, numbered.table, numbered.column, row);
          await db.runAsync(sql, rowValues(t, row) as (string | number | null)[]);
          applied++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return applied;
}

async function pullChanges(base: string, token: string, since: number): Promise<number> {
  const from = Math.max(0, since - OVERLAP_MS);
  const payload = await api(base, `/sync/pull?since=${from}`, token, { method: 'GET' });
  await applyPull(payload);
  return typeof payload.cursor === 'number' ? payload.cursor : since;
}

export interface SyncResult { pushedCursor: number; pulledCursor: number; at: number }

/** Full reconcile for the device already bound to this store: push then pull. */
export async function syncNow(): Promise<SyncResult> {
  const state = await getSyncState();
  if (!isConfigured(state)) throw new Error('La sincronización en la nube aún no está configurada');
  const store = await getStore();
  if (!store) throw new Error('No hay una tienda para sincronizar');
  const base = state.server_url!;

  try {
    if (await hasPendingRotationOn(getDb())) await rotateKitOn(getDb(), kitDeps(base));
    const token = (await getSyncState()).token!;
    await register(base, token, store.id);
    const pushedCursor = await pushChanges(base, token, state.last_pushed_at);
    const pulledCursor = await pullChanges(base, token, state.last_pulled_at);
    const at = Date.now();
    await getDb().runAsync(
      'UPDATE sync_state SET last_pushed_at = ?, last_pulled_at = ?, last_synced_at = ? WHERE id = 1',
      [pushedCursor, pulledCursor, at],
    );
    return { pushedCursor, pulledCursor, at };
  } catch (error) {
    if (error instanceof SyncHttpError && error.status === 401) throw new SyncHttpError(KEY_CHANGED_MESSAGE, 401, 'key_changed', null);
    throw error;
  }
}

export interface CloudActivation { sync: SyncResult; words: string[] | null }

export async function turnOnCloudBackup(): Promise<CloudActivation> {
  if (!hasHostedSync()) throw new Error('El respaldo en la nube no está configurado en esta compilación.');
  const state = await getSyncState();
  let words: string[] | null = null;
  if (!state.token || !state.token.trim()) words = await startKitOn(getDb(), kitDeps(DEFAULT_SYNC_URL), DEFAULT_SYNC_URL);
  else await saveSyncConfig(DEFAULT_SYNC_URL, state.token);
  return { sync: await syncNow(), words };
}

export async function getKit(): Promise<KitInfo | null> {
  return loadKitOn(getDb(), { sha256: sha256Bytes });
}

export async function getKitStatus(): Promise<KitStatus> {
  return kitStatusOn(getDb());
}

export async function confirmKit(positions: readonly number[], typed: readonly string[]): Promise<boolean> {
  return confirmKitOn(getDb(), { sha256: sha256Bytes, now: () => Date.now() }, positions, typed);
}

export async function changeShopKey(): Promise<string[]> {
  const state = await getSyncState();
  if (!isConfigured(state)) throw new Error('Activa primero el respaldo en la nube.');
  const result = await rotateKitOn(getDb(), kitDeps(state.server_url!));
  if (result.status !== 'ok') throw new Error('Activa primero el respaldo en la nube.');
  return result.words;
}

export async function recoverWithKit(text: string): Promise<number> {
  if (!hasHostedSync()) throw new Error('El respaldo en la nube no está configurado en esta compilación.');
  const result = await recoverFromKitOn(
    getDb(),
    {
      sha256: sha256Bytes,
      now: () => Date.now(),
      serverUrl: DEFAULT_SYNC_URL,
      isAuthFailure: (error) => error instanceof SyncHttpError && error.status === 401,
    },
    text,
    (token) => restoreFromCloud(DEFAULT_SYNC_URL, token),
  );
  if (result.status === 'invalid') throw new Error(result.message);
  if (result.status === 'locked') {
    const seconds = Math.max(1, Math.ceil((result.retryAt - Date.now()) / 1000));
    throw new Error(`Demasiados intentos. Espera ${seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`} e inténtalo de nuevo.`);
  }
  return result.restored;
}

/** Link this device to an existing shop using its code (destructive: replaces local data). */
export async function linkDeviceByCode(code: string): Promise<number> {
  if (!hasHostedSync()) throw new Error('El respaldo en la nube no está configurado en esta compilación.');
  const token = normalizeCode(code);
  if (token.length >= 24) return recoverWithKit(code);
  if (token.length < 12) throw new Error('Ese código parece muy corto; revísalo e intenta de nuevo.');
  return restoreFromCloud(DEFAULT_SYNC_URL, token);
}

/** This shop's code (formatted for display), or null if backup isn't on yet. */
export async function getShopCode(): Promise<string | null> {
  const s = await getSyncState();
  return s.token && !isKitToken(s.token) ? formatCode(s.token) : null;
}

/**
 * Adopt a store from the cloud onto a fresh/second device: wipe local synced
 * data, pull everything for the token's store, and save the config. Destructive
 * — the UI confirms first. Caller reloads the session afterward.
 */
export async function restoreFromCloud(serverUrl: string, token: string): Promise<number> {
  const base = serverUrl.trim().replace(/\/+$/, '');
  const tk = token.trim();
  // Verify the token resolves to a store before wiping anything.
  const payload = await api(base, '/sync/pull?since=0', tk, { method: 'GET' });
  if (!payload || typeof payload.tables !== 'object' || payload.tables === null) {
    throw new Error('La nube devolvió una respuesta inválida. No se modificó nada.');
  }
  const db = getDb();
  const current = await getStore().catch(() => null);
  try {
    await writeSafetyBackup(current?.name ?? 'Surtivox');
  } catch {
    throw new Error('No se pudo crear la copia de seguridad antes de restaurar. No se modificó nada.');
  }
  let applied = 0;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (let i = SYNC_TABLES.length - 1; i >= 0; i--) await db.runAsync(`DELETE FROM "${SYNC_TABLES[i]!.name}"`);
      for (const t of SYNC_TABLES) {
        const rows = payload.tables[t.name];
        if (!Array.isArray(rows)) continue;
        const sql = upsertSql(t);
        for (const row of rows) {
          await db.runAsync(sql, rowValues(t, row) as (string | number | null)[]);
          applied++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  const cursor = typeof payload.cursor === 'number' ? payload.cursor : Date.now();
  await saveSyncConfig(base, tk);
  await db.runAsync('UPDATE sync_state SET last_pulled_at = ?, last_synced_at = ? WHERE id = 1', [cursor, Date.now()]);
  return applied;
}

export async function kitReminderNow(): Promise<{ title: string; body: string } | null> {
  const input = await readKitReminderInputOn(getDb());
  if (!shouldRemindKit({ now: Date.now(), ...input })) return null;
  return kitReminderText(input.status);
}

export async function snoozeKitReminder(): Promise<void> {
  await snoozeKitReminderOn(getDb(), Date.now() + 2 * 24 * 3_600_000);
}
