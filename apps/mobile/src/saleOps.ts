import type { SQLiteDatabase } from 'expo-sqlite';

export type SaleOpsDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync' | 'runAsync' | 'withTransactionAsync'>;

export interface SaleOpsIds {
  newId: () => string;
  deviceId: string;
}

export interface ReturnCheck {
  saleItemId: string;
  name: string;
  soldQuantity: number;
  quantity: number;
}

export async function assertReturnable(
  db: Pick<SQLiteDatabase, 'getFirstAsync'>,
  saleId: string,
  checks: readonly ReturnCheck[],
): Promise<void> {
  const current = await db.getFirstAsync<{ status: string }>('SELECT status FROM sales WHERE id=?', [saleId]);
  if (current?.status !== 'completed') throw new Error('No se puede devolver una venta anulada');
  for (const check of checks) {
    const done = await db.getFirstAsync<{ n: number }>(
      'SELECT COALESCE(SUM(quantity),0) AS n FROM return_items WHERE sale_item_id=?',
      [check.saleItemId],
    );
    const remaining = check.soldQuantity - (done?.n ?? 0);
    if (check.quantity > remaining) throw new Error(`No puedes devolver más de ${remaining} de ${check.name}`);
  }
}

export async function voidSaleOn(
  db: SaleOpsDatabase,
  ids: SaleOpsIds,
  storeId: string,
  saleId: string,
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<{ customer_id: string | null; status: string; grand_total: number }>(
      'SELECT customer_id, status, grand_total FROM sales WHERE id=? AND store_id=?',
      [saleId, storeId],
    );
    if (!sale) throw new Error('No se encontró la venta');
    if (sale.status !== 'completed') throw new Error('La venta ya está anulada');
    const returns = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(grand_total),0) AS total FROM returns WHERE sale_id=?',
      [saleId],
    );
    if ((returns?.total ?? 0) > 0) throw new Error('Esta venta tiene devoluciones; no se puede anular');
    const items = await db.getAllAsync<{ product_id: string | null; quantity: number; track_inventory: number | null }>(
      `SELECT si.product_id, si.quantity, p.track_inventory
       FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
       WHERE si.sale_id=?`,
      [saleId],
    );
    const ledger = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) AS c FROM customer_ledger WHERE reference_type='sale' AND reference_id=?",
      [saleId],
    );
    const voided = await db.runAsync(
      "UPDATE sales SET status='void', updated_at=?, version=version+1 WHERE id=? AND store_id=? AND status='completed'",
      [now, saleId, storeId],
    );
    if (voided.changes !== 1) throw new Error('La venta ya está anulada');
    for (const item of items) {
      if (!item.product_id || item.track_inventory === 0) continue;
      await db.runAsync(
        `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,note,created_at,device_id)
         VALUES (?,?,?,'sale_return',?,'sale_void',?,?,?,?)`,
        [ids.newId(), storeId, item.product_id, item.quantity, saleId, 'Anulación de venta', now, ids.deviceId],
      );
    }
    if (sale.customer_id && (ledger?.c ?? 0) > 0) {
      await db.runAsync(
        `INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,reference_id,note,created_at,device_id)
         VALUES (?,?,?,'adjustment',?,'sale_void',?,?,?,?)`,
        [ids.newId(), storeId, sale.customer_id, -sale.grand_total, saleId, 'Anulación de venta', now, ids.deviceId],
      );
    }
  });
}
