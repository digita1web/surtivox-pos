import type { SaleOpsDatabase } from './saleOps.ts';
import { countDiff, type CountKind } from './stockCount.ts';

export interface CountIds {
  newId: () => string;
  deviceId: string;
  now?: () => number;
}

export interface CountResult {
  lineId: string;
  productId: string;
  name: string;
  expected: number;
  counted: number;
  delta: number;
  kind: CountKind;
  units: number;
  value: number;
  movementId: string | null;
}

export interface CountLine {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  expected_qty: number;
  counted_qty: number;
  unit_cost: number;
  movement_id: string | null;
  created_at: number;
}

const clock = (ids: CountIds) => (ids.now ? ids.now() : Date.now());

export async function expectedStockOn(db: Pick<SaleOpsDatabase, 'getFirstAsync'>, productId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(SUM(quantity_delta),0) AS n FROM stock_movements WHERE product_id=?', [productId],
  );
  return Number(row?.n ?? 0);
}

export async function openCountOn(db: SaleOpsDatabase, ids: CountIds, storeId: string, staffId: string | null): Promise<string> {
  const open = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM stock_counts WHERE store_id=? AND status='open' AND staff_id IS ? ORDER BY started_at DESC LIMIT 1`,
    [storeId, staffId],
  );
  if (open) return open.id;
  const id = ids.newId();
  const now = clock(ids);
  await db.runAsync(
    `INSERT INTO stock_counts (id,store_id,staff_id,status,started_at,created_at,updated_at,device_id,version)
     VALUES (?,?,?,'open',?,?,?,?,1)`,
    [id, storeId, staffId, now, now, now, ids.deviceId],
  );
  return id;
}

export async function recordCountOn(
  db: SaleOpsDatabase,
  ids: CountIds,
  countId: string,
  productId: string,
  counted: number,
): Promise<CountResult> {
  if (!Number.isInteger(counted) || counted < 0) throw new Error('La cantidad contada debe ser un número entero de 0 o más');
  let result: CountResult | null = null;
  await db.withTransactionAsync(async () => {
    const count = await db.getFirstAsync<{ store_id: string; status: string }>(
      'SELECT store_id, status FROM stock_counts WHERE id=?', [countId],
    );
    if (!count) throw new Error('El conteo no existe');
    if (count.status !== 'open') throw new Error('Este conteo ya se terminó. Inicia uno nuevo.');
    const product = await db.getFirstAsync<{ name: string; cost_price: number; track_inventory: number; store_id: string; deleted_at: number | null }>(
      'SELECT name, cost_price, track_inventory, store_id, deleted_at FROM products WHERE id=?', [productId],
    );
    if (!product || product.store_id !== count.store_id || product.deleted_at !== null) throw new Error('El producto no existe en esta tienda');
    if (!product.track_inventory) throw new Error(`${product.name} no controla inventario`);
    const expected = await expectedStockOn(db, productId);
    const diff = countDiff(expected, counted, product.cost_price);
    const now = clock(ids);
    let movementId: string | null = null;
    if (diff.delta !== 0) {
      movementId = ids.newId();
      await db.runAsync(
        `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,note,created_at,device_id)
         VALUES (?,?,?,'adjustment',?,'stock_count',?,'Conteo físico',?,?)`,
        [movementId, count.store_id, productId, diff.delta, countId, now, ids.deviceId],
      );
    }
    const lineId = ids.newId();
    await db.runAsync(
      `INSERT INTO stock_count_lines (id,count_id,product_id,product_name_snapshot,expected_qty,counted_qty,unit_cost,movement_id,created_at,device_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [lineId, countId, productId, product.name, expected, counted, product.cost_price, movementId, now, ids.deviceId],
    );
    result = { lineId, productId, name: product.name, expected, counted, ...diff, movementId };
  });
  return result!;
}

export async function closeCountOn(db: Pick<SaleOpsDatabase, 'runAsync'>, ids: Pick<CountIds, 'now'>, countId: string): Promise<boolean> {
  const now = ids.now ? ids.now() : Date.now();
  const r = await db.runAsync(
    `UPDATE stock_counts SET status='closed', closed_at=?, updated_at=?, version=version+1 WHERE id=? AND status='open'`,
    [now, now, countId],
  );
  return r.changes > 0;
}

export async function countLinesOn(db: Pick<SaleOpsDatabase, 'getAllAsync'>, countId: string): Promise<CountLine[]> {
  return db.getAllAsync<CountLine>(
    `SELECT id, product_id, product_name_snapshot, expected_qty, counted_qty, unit_cost, movement_id, created_at
     FROM stock_count_lines WHERE count_id=? ORDER BY created_at DESC, id DESC`, [countId],
  );
}

export async function lastCountAtOn(db: Pick<SaleOpsDatabase, 'getFirstAsync'>, storeId: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ at: number | null }>(
    `SELECT MAX(l.created_at) AS at FROM stock_count_lines l JOIN stock_counts c ON c.id = l.count_id WHERE c.store_id=?`, [storeId],
  );
  return row?.at ?? null;
}
