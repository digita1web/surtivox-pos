import { computeCart, settlePayments, asMinor, asBps, type CartLineInput, type Minor } from '@surtivox/pos-core';
import type { SaleOpsDatabase, SaleOpsIds } from './saleOps.ts';
import { runGuarded } from './serialQueue.ts';

export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'bank' | 'credit';

export interface CheckoutProduct {
  id: string;
  name: string;
  selling_price: number;
  cost_price: number;
  tax_bps: number;
  track_inventory?: number;
  isQuick?: boolean;
}

export interface CheckoutLine {
  product: CheckoutProduct;
  quantity: number;
}

export interface Receipt {
  invoiceNo: string;
  paymentMethod: PaymentMethod;
  lines: { name: string; quantity: number; lineTotal: Minor }[];
  subtotal: Minor;
  discountTotal: Minor;
  taxTotal: Minor;
  grandTotal: Minor;
  received: Minor;
  change: Minor;
  soldAt: number;
}

export interface CheckoutOptions {
  paymentMethod: PaymentMethod;
  received: Minor;
  discountBps?: number;
  customerId?: string | null;
  staffId?: string | null;
}

export function checkoutSaleOn(
  db: SaleOpsDatabase,
  ids: SaleOpsIds,
  storeId: string,
  lines: CheckoutLine[],
  opts: CheckoutOptions,
  now: number = Date.now(),
): Promise<Receipt> {
  const key = JSON.stringify([
    'sale', storeId, opts.paymentMethod, opts.received, opts.discountBps ?? 0, opts.customerId ?? null,
    lines.map((l) => [l.product.id, l.product.name, l.product.selling_price, l.quantity]),
  ]);
  return runGuarded(key, 'Esta venta ya se está registrando. Espera un momento.', () => performCheckout(db, ids, storeId, lines, opts, now));
}

export async function nextInvoiceNumber(db: Pick<SaleOpsDatabase, 'getFirstAsync'>, storeId: string): Promise<string> {
  const row = await db.getFirstAsync<{ n: number | null }>(
    "SELECT MAX(CAST(SUBSTR(invoice_no, 5) AS INTEGER)) AS n FROM sales WHERE store_id=? AND invoice_no LIKE 'INV-%'",
    [storeId],
  );
  return `INV-${String((row?.n ?? 0) + 1).padStart(4, '0')}`;
}

async function performCheckout(
  db: SaleOpsDatabase,
  ids: SaleOpsIds,
  storeId: string,
  lines: CheckoutLine[],
  opts: CheckoutOptions,
  now: number,
): Promise<Receipt> {
  const isCredit = opts.paymentMethod === 'credit';
  if (isCredit && !opts.customerId) throw new Error('Selecciona un cliente para una venta fiada');

  const cartInputs: CartLineInput[] = lines.map((l) => ({
    unitPrice: asMinor(l.product.selling_price),
    quantity: l.quantity,
    taxBps: asBps(l.product.tax_bps),
  }));
  const cartDiscount = opts.discountBps && opts.discountBps > 0
    ? ({ kind: 'percent', bps: asBps(opts.discountBps) } as const)
    : ({ kind: 'none' } as const);
  const totals = computeCart(cartInputs, cartDiscount);
  const settlement = isCredit
    ? settlePayments(totals.grandTotal, [], { allowUnderpayment: true })
    : settlePayments(totals.grandTotal, [{ amount: opts.received }]);

  const saleId = ids.newId();
  let invoiceNo = '';

  await db.withTransactionAsync(async () => {
    invoiceNo = await nextInvoiceNumber(db, storeId);
    await db.runAsync(
      `INSERT INTO sales (id,store_id,invoice_no,customer_id,staff_id,status,subtotal,discount_total,tax_total,grand_total,sold_at,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,'completed',?,?,?,?,?,?,?,?,1)`,
      [saleId, storeId, invoiceNo, opts.customerId ?? null, opts.staffId ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.grandTotal, now, now, now, ids.deviceId],
    );
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      const line = totals.lines[i]!;
      const productId = l.product.isQuick ? null : l.product.id;
      await db.runAsync(
        `INSERT INTO sale_items (id,sale_id,product_id,product_name_snapshot,sku_snapshot,unit_cost,unit_price,quantity,discount,tax,line_total,created_at,device_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ids.newId(), saleId, productId, l.product.name, null, l.product.cost_price, l.product.selling_price, l.quantity, line.discount, line.tax, line.lineTotal, now, ids.deviceId],
      );
      if (productId && (l.product.track_inventory ?? 1) === 1) {
        await db.runAsync(
          `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
           VALUES (?,?,?,'sale',?, 'sale', ?, ?, ?)`,
          [ids.newId(), storeId, productId, -l.quantity, saleId, now, ids.deviceId],
        );
      }
    }
    if (isCredit) {
      await db.runAsync(
        `INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,reference_id,created_at,device_id)
         VALUES (?,?,?,'sale',?, 'sale', ?, ?, ?)`,
        [ids.newId(), storeId, opts.customerId ?? null, totals.grandTotal, saleId, now, ids.deviceId],
      );
    } else {
      await db.runAsync(
        `INSERT INTO payments (id,sale_id,type,amount,created_at,device_id) VALUES (?,?,?,?,?,?)`,
        [ids.newId(), saleId, opts.paymentMethod, totals.grandTotal, now, ids.deviceId],
      );
    }
  });

  return {
    invoiceNo,
    paymentMethod: opts.paymentMethod,
    lines: lines.map((l, i) => ({ name: l.product.name, quantity: l.quantity, lineTotal: totals.lines[i]!.lineTotal })),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    received: opts.received,
    change: settlement.change,
    soldAt: now,
  };
}

export function recordCustomerPaymentOn(
  db: SaleOpsDatabase,
  ids: SaleOpsIds,
  storeId: string,
  customerId: string,
  amount: Minor,
  note?: string,
  now: number = Date.now(),
): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount <= 0) return Promise.reject(new Error('El pago debe ser un número entero mayor que cero'));
  const key = JSON.stringify(['payment', storeId, customerId, amount]);
  return runGuarded(key, 'Este abono ya se está registrando. Espera un momento.', () => insertPayment(db, ids, storeId, customerId, amount, note, now));
}

async function insertPayment(
  db: SaleOpsDatabase,
  ids: SaleOpsIds,
  storeId: string,
  customerId: string,
  amount: Minor,
  note: string | undefined,
  now: number,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ balance: number }>(
      'SELECT COALESCE(SUM(amount),0) AS balance FROM customer_ledger WHERE customer_id=?',
      [customerId],
    );
    const balance = row?.balance ?? 0;
    if (balance <= 0) throw new Error('Este cliente no tiene deuda pendiente.');
    if (amount > balance) throw new Error('El abono no puede ser mayor que lo que el cliente debe.');
    await db.runAsync(
      `INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,note,created_at,device_id)
       VALUES (?,?,?,'payment',?, 'manual', ?, ?, ?)`,
      [ids.newId(), storeId, customerId, -amount, note?.trim() || null, now, ids.deviceId],
    );
  });
}
