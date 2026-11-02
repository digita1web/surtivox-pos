import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { toCsv, parseCsv, fromMajorString, asMinor } from '@surtivox/pos-core';
import {
  listProducts, salesExportRows, findProductByBarcode, createProduct, updateProductFields, getStore,
} from './repos';
import type { Store } from './repos';
import { APP_CURRENCY } from './branding';
import { getDb } from './db';
import { validateBackupPayload } from './backupValidation';

const major = (minor: number, dec: number) => (minor / 10 ** dec).toFixed(dec);
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

async function writeAndShare(filename: string, csv: string): Promise<void> {
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
  }
}

export async function exportProducts(store: Store): Promise<number> {
  const dec = APP_CURRENCY.decimals;
  const products = await listProducts(store.id);
  const rows = products.map((p) => [
    p.name, p.barcode ?? '', major(p.selling_price, dec), major(p.cost_price, dec), String(p.tax_bps / 100), String(p.stock),
  ]);
  const csv = toCsv(['name', 'barcode', 'selling_price', 'cost_price', 'tax_percent', 'stock'], rows);
  await writeAndShare(`products-${stamp()}.csv`, csv);
  return products.length;
}

export async function exportSales(store: Store): Promise<number> {
  const dec = APP_CURRENCY.decimals;
  const rows = await salesExportRows(store.id);
  const body = rows.map((r) => [
    r.invoice_no, new Date(r.sold_at).toISOString(), r.product, String(r.quantity),
    major(r.unit_price, dec), major(r.line_total, dec), major(r.grand_total, dec),
  ]);
  const csv = toCsv(['invoice', 'date', 'product', 'quantity', 'unit_price', 'line_total', 'sale_total'], body);
  await writeAndShare(`sales-${stamp()}.csv`, csv);
  return rows.length;
}

/* -------------------- full-database backup & restore -------------------- */

const TABLES_SQL = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_migrations','sync_state','catalog_outbox','catalog_cache') ORDER BY name`;
const ALL_TABLES_SQL = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`;
const BACKUP_MAGIC = 'surtivoxpos';
const SAFETY_PREFIX = 'surtivox-antes-de-restaurar-';

const safetyStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

async function readAppliedMigrations(db: ReturnType<typeof getDb>): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM _migrations');
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

async function readSchema(db: ReturnType<typeof getDb>): Promise<Record<string, string[]>> {
  const schema: Record<string, string[]> = {};
  const tables = await db.getAllAsync<{ name: string }>(ALL_TABLES_SQL);
  for (const { name } of tables) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${name.replace(/"/g, '""')}")`);
    schema[name] = columns.map((column) => column.name);
  }
  return schema;
}

async function collectFullBackup(storeName: string): Promise<{ payload: Record<string, unknown>; rows: number }> {
  const db = getDb();
  const tables = (await db.getAllAsync<{ name: string }>(TABLES_SQL)).map((row) => row.name);
  const data: Record<string, unknown[]> = {};
  let rows = 0;
  for (const table of tables) {
    const list = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM "${table}"`);
    data[table] = list;
    rows += list.length;
  }
  const migrations = await readAppliedMigrations(db);
  return {
    payload: { app: BACKUP_MAGIC, schema: 1, migrations, exported_at: Date.now(), store: storeName, tables: data },
    rows,
  };
}

async function safetyDirectory(): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('El almacenamiento interno no está disponible.');
  const directory = `${base}safety/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

async function writeSafetyBackup(storeName: string): Promise<void> {
  const directory = await safetyDirectory();
  const filename = `${SAFETY_PREFIX}${safetyStamp()}.json`;
  const { payload } = await collectFullBackup(storeName);
  await FileSystem.writeAsStringAsync(`${directory}${filename}`, JSON.stringify(payload), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const files = (await FileSystem.readDirectoryAsync(directory))
    .filter((name) => name.startsWith(SAFETY_PREFIX))
    .sort()
    .reverse();
  for (const old of files.slice(2)) {
    await FileSystem.deleteAsync(`${directory}${old}`, { idempotent: true });
  }
}

export async function exportFullBackup(store: Store): Promise<number> {
  const { payload, rows } = await collectFullBackup(store.name);
  const filename = `surtivox-backup-${stamp()}.json`;
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: filename, UTI: 'public.json' });
  }
  return rows;
}

export interface RestoreResult { tables: number; rows: number }

export async function restoreFullBackup(): Promise<RestoreResult | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido'); }

  const db = getDb();
  const schema = await readSchema(db);
  const appliedMigrations = await readAppliedMigrations(db);
  const validation = validateBackupPayload(parsed, schema, appliedMigrations);
  if (!validation.ok) throw new Error(validation.reason);

  const payload = parsed as { tables: Record<string, Record<string, unknown>[]> };
  const tableNames = Object.keys(payload.tables);
  const currentStore = await getStore().catch(() => null);

  try {
    await writeSafetyBackup(currentStore?.name ?? 'Surtivox');
  } catch {
    throw new Error('No se pudo crear la copia de seguridad antes de restaurar. No se modificó nada.');
  }

  let rows = 0;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const table of tableNames) await db.runAsync(`DELETE FROM "${table}"`);
      for (const table of tableNames) {
        for (const row of payload.tables[table]!) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;
          const columnList = columns.map((column) => `"${column}"`).join(',');
          const params = columns.map((column) => row[column] as string | number | null);
          await db.runAsync(`INSERT INTO "${table}" (${columnList}) VALUES (${columns.map(() => '?').join(',')})`, params);
          rows++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return { tables: tableNames.length, rows };
}

export interface ImportResult { created: number; updated: number; skipped: number }

const ALIASES: Record<string, string[]> = {
  name: ['name', 'product', 'title'],
  barcode: ['barcode', 'code', 'sku'],
  selling_price: ['selling_price', 'price', 'sell', 'selling'],
  cost_price: ['cost_price', 'cost', 'buy'],
  tax_percent: ['tax_percent', 'tax', 'tax%'],
  stock: ['stock', 'quantity', 'qty', 'opening_stock'],
};

function columnIndex(headers: string[], field: keyof typeof ALIASES): number {
  const hs = headers.map((h) => h.trim().toLowerCase());
  for (const a of ALIASES[field]!) { const i = hs.indexOf(a); if (i >= 0) return i; }
  return -1;
}

/** Pick a CSV file and upsert products. Match by barcode; otherwise create. */
export async function importProducts(store: Store): Promise<ImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  const rows = parseCsv(text);
  if (rows.length < 2) return { created: 0, updated: 0, skipped: 0 };

  const headers = rows[0]!;
  const iName = columnIndex(headers, 'name');
  const iBarcode = columnIndex(headers, 'barcode');
  const iSell = columnIndex(headers, 'selling_price');
  const iCost = columnIndex(headers, 'cost_price');
  const iTax = columnIndex(headers, 'tax_percent');
  const iStock = columnIndex(headers, 'stock');
  if (iName < 0 || iSell < 0) throw new Error('El CSV debe incluir al menos las columnas "name" y "selling_price"');

  const dec = APP_CURRENCY.decimals;
  let created = 0, updated = 0, skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const name = (row[iName] ?? '').trim();
    const barcode = iBarcode >= 0 ? (row[iBarcode] ?? '').trim() : '';
    try {
      if (!name) { skipped++; continue; }
      const sellingPrice = fromMajorString(row[iSell]?.trim() || '0', dec);
      if (sellingPrice <= 0) { skipped++; continue; }
      const costPrice = iCost >= 0 ? fromMajorString(row[iCost]?.trim() || '0', dec) : asMinor(0);
      const taxBps = iTax >= 0 ? Math.max(0, Math.round((parseFloat(row[iTax]?.trim() || '0') || 0) * 100)) : 0;
      const openingStock = iStock >= 0 ? Math.max(0, Math.floor(parseFloat(row[iStock]?.trim() || '0') || 0)) : 0;

      const existing = barcode ? await findProductByBarcode(store.id, barcode) : null;
      if (existing) {
        await updateProductFields({ id: existing.id, name, sellingPrice, costPrice, taxBps, barcode });
        updated++;
      } else {
        await createProduct({ storeId: store.id, name, barcode: barcode || null, imageUri: null, sellingPrice, costPrice, taxBps, openingStock });
        created++;
      }
    } catch { skipped++; }
  }
  return { created, updated, skipped };
}
