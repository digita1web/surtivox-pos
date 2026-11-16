import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { getLocalSetting, setLocalSetting } from './repos';
import {
  CATALOG_PACK_BASE, PACK_SETTING, PACK_TYPE_SETTING, attributionOn, barcodePackOn, base64ToBytes, bytesToHex, checkPackOn, firstBarcodeOn,
  installPackOn, isBusinessType, packFileName, parseInstalled, searchPackOn,
  type BusinessTypeId, type InstallResult, type InstalledPack, type PackHit, type PackIo,
} from './catalogPack';

const DIR = `${FileSystem.documentDirectory}SQLite/`;
const MANIFEST_TIMEOUT_MS = 15_000;

let current: { type: BusinessTypeId; db: SQLiteDatabase } | null = null;

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

async function release(): Promise<void> {
  const open = current;
  current = null;
  if (open) await open.db.closeAsync().catch(() => {});
}

async function fileSha256(path: string): Promise<string> {
  const bytes = base64ToBytes(await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 }));
  const input = new Uint8Array(new ArrayBuffer(bytes.length));
  input.set(bytes);
  return bytesToHex(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input)));
}

async function fileSize(path: string): Promise<number | null> {
  const info = await FileSystem.getInfoAsync(path);
  return info.exists && !info.isDirectory ? info.size : null;
}

async function fetchManifest(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`No se pudo consultar el catálogo publicado (HTTP ${res.status}).`);
    return await res.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('El servidor del catálogo no respondió a tiempo. Revisa tu conexión.');
    if (e instanceof Error && /HTTP/.test(e.message)) throw e;
    throw new Error('No se pudo conectar para descargar el catálogo. Revisa tu conexión e intenta de nuevo; una vez descargado funciona sin internet.');
  } finally {
    clearTimeout(timer);
  }
}

const io: PackIo = {
  fetchManifest,
  download: async (url, path) => {
    const res = await FileSystem.downloadAsync(url, path);
    if (res.status !== 200) throw new Error(`No se pudo descargar el catálogo (HTTP ${res.status}).`);
  },
  sha256: fileSha256,
  size: fileSize,
  move: (from, to) => FileSystem.moveAsync({ from, to }),
  remove: (path) => FileSystem.deleteAsync(path, { idempotent: true }),
  release,
  verify: async (path, type) => {
    const db = await openDatabaseAsync(baseName(path), {}, DIR);
    try { await checkPackOn(db, type); } finally { await db.closeAsync().catch(() => {}); }
  },
  readSetting: getLocalSetting,
  writeSetting: setLocalSetting,
  now: () => Date.now(),
};

export async function getPackType(): Promise<BusinessTypeId> {
  const saved = await getLocalSetting(PACK_TYPE_SETTING).catch(() => null);
  return isBusinessType(saved) ? saved : 'tienda';
}

export async function setPackType(type: BusinessTypeId): Promise<void> {
  await setLocalSetting(PACK_TYPE_SETTING, type);
}

export async function getInstalledPack(): Promise<InstalledPack | null> {
  const installed = parseInstalled(await getLocalSetting(PACK_SETTING).catch(() => null));
  if (!installed) return null;
  if ((await fileSize(`${DIR}${packFileName(installed.type)}`)) === null) return null;
  return installed;
}

export async function installCatalogPack(type: BusinessTypeId): Promise<InstallResult> {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  return installPackOn(io, { base: CATALOG_PACK_BASE, dir: DIR, type });
}

export async function removeCatalogPack(): Promise<void> {
  const installed = parseInstalled(await getLocalSetting(PACK_SETTING).catch(() => null));
  await release();
  if (installed) await FileSystem.deleteAsync(`${DIR}${packFileName(installed.type)}`, { idempotent: true });
  await setLocalSetting(PACK_SETTING, '');
}

async function openPack(): Promise<SQLiteDatabase | null> {
  const installed = await getInstalledPack();
  if (!installed) {
    await release();
    return null;
  }
  if (current && current.type === installed.type) return current.db;
  await release();
  const db = await openDatabaseAsync(packFileName(installed.type), {}, DIR);
  current = { type: installed.type, db };
  return db;
}

export async function searchCatalog(query: string, limit = 6): Promise<PackHit[]> {
  const db = await openPack().catch(() => null);
  return db ? searchPackOn(db, query, limit).catch(() => []) : [];
}

export async function lookupCatalogBarcode(code: string): Promise<PackHit | null> {
  const db = await openPack().catch(() => null);
  return db ? barcodePackOn(db, code).catch(() => null) : null;
}

export async function catalogBarcodeFor(productId: string): Promise<string | null> {
  const db = await openPack().catch(() => null);
  return db ? firstBarcodeOn(db, productId).catch(() => null) : null;
}

export async function catalogAttribution(): Promise<string[]> {
  const db = await openPack().catch(() => null);
  return db ? attributionOn(db).catch(() => []) : [];
}
