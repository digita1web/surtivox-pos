import type { SQLiteDatabase } from 'expo-sqlite';
import {
  buildCatalogContribution, buildProductInput, draftKey, type CatalogContribution, type WizardDraft,
} from './productWizard.ts';

export type FinishDb = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'>;

export interface FinishProduct {
  id: string;
  name: string;
  barcode: string | null;
  image_uri: string | null;
  selling_price: number;
  cost_price: number;
  tax_bps: number;
  stock: number;
  track_inventory: number;
  unit: string;
  category_id: string | null;
  category_name: string | null;
}

export interface FinishDeps {
  now: () => number;
  newId: () => string;
  deviceId: string;
  catalogEnabled: boolean;
  getCatalogOptIn: () => Promise<string | null>;
  enqueueContribution: (contribution: CatalogContribution) => Promise<boolean>;
  flushQueue: () => void;
}

export type FinishResult =
  | { status: 'created' | 'existing'; product: FinishProduct; queued: boolean }
  | { status: 'invalid'; message: string };

interface ProductRow {
  id: string;
  name: string;
  barcode: string | null;
  image_uri: string | null;
  selling_price: number;
  cost_price: number;
  tax_bps: number;
  unit: string | null;
  category_id: string | null;
  category_name: string | null;
}

const SELECT_BY_BARCODE = `SELECT p.id, p.name, p.barcode, p.image_uri, p.selling_price, p.cost_price, p.tax_bps, p.unit, p.category_id, c.name AS category_name
  FROM products p LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.store_id = ? AND p.barcode = ? AND p.active = 1 AND p.deleted_at IS NULL LIMIT 1`;

const toProduct = (row: ProductRow): FinishProduct => ({
  id: row.id,
  name: row.name,
  barcode: row.barcode,
  image_uri: row.image_uri,
  selling_price: row.selling_price,
  cost_price: row.cost_price,
  tax_bps: row.tax_bps,
  stock: 0,
  track_inventory: 0,
  unit: row.unit ?? 'unit',
  category_id: row.category_id,
  category_name: row.category_name,
});

export async function finishWizardOn(db: FinishDb, deps: FinishDeps, storeId: string, draft: WizardDraft): Promise<FinishResult> {
  const input = buildProductInput(draft);
  if (!input.ok) return { status: 'invalid', message: input.message };
  const { barcode, name, sellingPrice, photoUri } = input.value;

  let existing: ProductRow | null = null;
  let createdId: string | null = null;

  await db.withTransactionAsync(async () => {
    existing = await db.getFirstAsync<ProductRow>(SELECT_BY_BARCODE, [storeId, barcode]);
    if (!existing) {
      const category = input.value.categoryId
        ? await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id = ? AND store_id = ?', [input.value.categoryId, storeId])
        : null;
      const id = deps.newId();
      const now = deps.now();
      await db.runAsync(
        `INSERT INTO products (id,store_id,category_id,name,sku,barcode,image_uri,cost_price,selling_price,unit,track_inventory,low_stock_threshold,tax_bps,active,created_at,updated_at,device_id,version)
         VALUES (?,?,?,?,NULL,?,?,0,?,'unit',0,NULL,0,1,?,?,?,1)`,
        [id, storeId, category?.id ?? null, name, barcode, photoUri, sellingPrice, now, now, deps.deviceId],
      );
      createdId = id;
    }
    await db.runAsync('DELETE FROM local_settings WHERE key=?', [draftKey(draft.barcode)]);
  });

  const row = existing ?? (await db.getFirstAsync<ProductRow>(SELECT_BY_BARCODE, [storeId, barcode]));
  if (!row) return { status: 'invalid', message: 'No se pudo crear el producto.' };

  let queued = false;
  if (createdId && deps.catalogEnabled) {
    try {
      const contribution = buildCatalogContribution(draft);
      if (contribution && (await deps.getCatalogOptIn()) === '1') {
        queued = await deps.enqueueContribution(contribution);
        if (queued) deps.flushQueue();
      }
    } catch {
      queued = false;
    }
  }
  return { status: createdId ? 'created' : 'existing', product: toProduct(row), queued };
}
