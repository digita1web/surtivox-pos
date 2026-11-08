import type { Minor } from '@surtivox/pos-core';
import { allowedRefundMethods, computeReturnRefunds, refundMethodError } from './effectiveLines.ts';
import { assertReturnable, type SaleOpsDatabase, type SaleOpsIds } from './saleOps.ts';

export interface SaleHeader {
  id: string; invoice_no: string; customer_id: string | null;
  subtotal: number; discount_total: number; tax_total: number; grand_total: number;
  sold_at: number; status: string; payment_method: string;
  staff_name: string | null;
}
export interface SaleItemRow {
  id: string; product_id: string | null; name: string;
  unit_price: number; unit_cost: number; quantity: number; tax: number; line_total: number;
  track_inventory?: number | null;
  returned: number;
  refunded: number;
  refunded_tax: number;
}
export interface SaleDetail { header: SaleHeader; items: SaleItemRow[]; refundedTotal: number }

export type RefundMethod = 'cash' | 'card' | 'bank' | 'account';
export interface ReturnPick { saleItemId: string; quantity: number }
export interface ReturnReceipt {
  saleInvoice: string; refundMethod: RefundMethod;
  lines: { name: string; quantity: number; lineTotal: Minor }[];
  subtotal: Minor; taxTotal: Minor; grandTotal: Minor; createdAt: number;
}

export async function getSaleOn(db: SaleOpsDatabase, saleId: string): Promise<SaleDetail | null> {
  const header = await db.getFirstAsync<SaleHeader>(
    `SELECT sales.id, invoice_no, customer_id, subtotal, discount_total, tax_total, grand_total, sold_at, status,
            COALESCE((SELECT type FROM payments WHERE sale_id = sales.id LIMIT 1), 'credit') AS payment_method,
            (SELECT name FROM staff WHERE staff.id = sales.staff_id) AS staff_name
     FROM sales WHERE sales.id = ?`, [saleId],
  );
  if (!header) return null;
  const items = await db.getAllAsync<SaleItemRow>(
    `SELECT si.id, si.product_id, si.product_name_snapshot AS name,
            si.unit_price, si.unit_cost, si.quantity, si.tax, si.line_total,
            p.track_inventory,
            COALESCE((SELECT SUM(ri.quantity) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS returned,
            COALESCE((SELECT SUM(ri.line_total) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS refunded,
            COALESCE((SELECT SUM(ri.tax) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS refunded_tax
     FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ?`, [saleId],
  );
  const r = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total FROM returns WHERE sale_id = ?`, [saleId],
  );
  return { header, items, refundedTotal: r?.total ?? 0 };
}

export async function processReturnOn(
  db: SaleOpsDatabase,
  ids: SaleOpsIds,
  storeId: string,
  saleId: string,
  picks: ReturnPick[],
  refundMethod: RefundMethod,
  reason?: string,
  now: number = Date.now(),
): Promise<ReturnReceipt> {
  const detail = await getSaleOn(db, saleId);
  if (!detail) throw new Error('No se encontró la venta');
  if (detail.header.status !== 'completed') throw new Error('No se puede devolver una venta anulada');
  if (refundMethod === 'account' && !detail.header.customer_id) {
    throw new Error('Esta venta no tiene cliente para devolver a su cuenta');
  }
  const allowed = allowedRefundMethods(detail.header.payment_method, Boolean(detail.header.customer_id));
  if (!allowed.includes(refundMethod)) {
    throw new Error(refundMethodError(detail.header.payment_method, Boolean(detail.header.customer_id)));
  }

  const returnId = ids.newId();
  const wanted = new Map<string, number>();
  for (const pick of picks) {
    if (pick.quantity <= 0) continue;
    wanted.set(pick.saleItemId, (wanted.get(pick.saleItemId) ?? 0) + pick.quantity);
  }
  const merged: ReturnPick[] = [...wanted].map(([saleItemId, quantity]) => ({ saleItemId, quantity }));
  const shares = computeReturnRefunds(detail.header.grand_total, detail.items, merged);
  const rows: { pick: ReturnPick; item: SaleItemRow; refundLine: number; refundTax: number }[] = [];
  for (const pick of merged) {
    const item = detail.items.find((i) => i.id === pick.saleItemId);
    if (!item) throw new Error('No se encontró el artículo en la venta');
    const remaining = item.quantity - item.returned;
    if (pick.quantity > remaining) throw new Error(`No puedes devolver más de ${remaining} de ${item.name}`);
    const share = shares.find((x) => x.id === item.id)!;
    rows.push({ pick, item, refundLine: share.line, refundTax: share.tax });
  }
  if (rows.length === 0) throw new Error('Selecciona al menos un artículo para devolver');

  const grandTotal = rows.reduce((n, r) => n + r.refundLine, 0);
  const taxTotal = rows.reduce((n, r) => n + r.refundTax, 0);
  const subtotal = grandTotal - taxTotal;

  await db.withTransactionAsync(async () => {
    await assertReturnable(db, saleId, rows.map((r) => ({ saleItemId: r.item.id, name: r.item.name, soldQuantity: r.item.quantity, quantity: r.pick.quantity })));
    await db.runAsync(
      `INSERT INTO returns (id,store_id,sale_id,customer_id,refund_method,subtotal,tax_total,grand_total,reason,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [returnId, storeId, saleId, detail.header.customer_id ?? null, refundMethod, subtotal, taxTotal, grandTotal, reason?.trim() || null, now, now, ids.deviceId],
    );
    for (const { pick, item, refundLine, refundTax } of rows) {
      await db.runAsync(
        `INSERT INTO return_items (id,return_id,sale_item_id,product_id,product_name_snapshot,unit_cost,unit_price,quantity,tax,line_total,created_at,device_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ids.newId(), returnId, item.id, item.product_id, item.name, item.unit_cost, item.unit_price, pick.quantity, refundTax, refundLine, now, ids.deviceId],
      );
      if (item.product_id && item.track_inventory !== 0) {
        await db.runAsync(
          `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
           VALUES (?,?,?,'sale_return',?, 'return', ?, ?, ?)`,
          [ids.newId(), storeId, item.product_id, pick.quantity, returnId, now, ids.deviceId],
        );
      }
    }
    if (refundMethod === 'account') {
      await db.runAsync(
        `INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,reference_id,created_at,device_id)
         VALUES (?,?,?,'refund',?, 'return', ?, ?, ?)`,
        [ids.newId(), storeId, detail.header.customer_id, -grandTotal, returnId, now, ids.deviceId],
      );
    }
  });

  return {
    saleInvoice: detail.header.invoice_no,
    refundMethod,
    lines: rows.map((r) => ({ name: r.item.name, quantity: r.pick.quantity, lineTotal: r.refundLine as Minor })),
    subtotal: subtotal as Minor, taxTotal: taxTotal as Minor, grandTotal: grandTotal as Minor, createdAt: now,
  };
}
