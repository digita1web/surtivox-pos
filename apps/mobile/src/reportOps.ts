import type { SaleOpsDatabase } from './saleOps.ts';
import { effectiveItems } from './effectiveLines.ts';

export interface ReportSummary {
  totalSales: number;
  transactions: number;
  itemsSold: number;
  grossProfit: number;
  discountTotal: number;
  refundTotal: number;
}

interface ItemRow {
  sale_id: string;
  item_id: string;
  grand_total: number;
  line_total: number;
  tax: number;
  unit_cost: number;
  quantity: number;
}

export async function reportSummaryOn(db: SaleOpsDatabase, storeId: string, since: number): Promise<ReportSummary> {
  const s = await db.getFirstAsync<{ total: number; txns: number; disc: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total, COUNT(*) AS txns, COALESCE(SUM(discount_total),0) AS disc
     FROM sales WHERE store_id=? AND status='completed' AND sold_at>=?`, [storeId, since],
  );
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT s.id AS sale_id, si.id AS item_id, s.grand_total, si.line_total, si.tax, si.unit_cost, si.quantity
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at>=?
     ORDER BY s.id, si.id`, [storeId, since],
  );
  let items = 0;
  let profit = 0;
  for (let start = 0; start < rows.length;) {
    let end = start;
    while (end < rows.length && rows[end]!.sale_id === rows[start]!.sale_id) end++;
    const group = rows.slice(start, end);
    const effective = effectiveItems(
      group[0]!.grand_total,
      group.map((r) => ({ id: r.item_id, quantity: r.quantity, line_total: r.line_total, tax: r.tax })),
    );
    group.forEach((r, i) => {
      items += r.quantity;
      profit += (effective[i]!.effectiveTotal - effective[i]!.effectiveTax) - r.unit_cost * r.quantity;
    });
    start = end;
  }
  const ret = await db.getFirstAsync<{ refund: number; items: number; profit: number }>(
    `SELECT COALESCE(SUM(ri.line_total),0) AS refund,
            COALESCE(SUM(ri.quantity),0) AS items,
            COALESCE(SUM((ri.line_total - ri.tax) - ri.unit_cost * ri.quantity),0) AS profit
     FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.store_id=? AND r.created_at>=?`, [storeId, since],
  );
  return {
    totalSales: s?.total ?? 0,
    transactions: s?.txns ?? 0,
    discountTotal: s?.disc ?? 0,
    refundTotal: ret?.refund ?? 0,
    itemsSold: items - (ret?.items ?? 0),
    grossProfit: profit - (ret?.profit ?? 0),
  };
}

export interface PaymentsReceived { total: number; count: number }

export async function paymentsReceivedOn(db: SaleOpsDatabase, storeId: string, since: number): Promise<PaymentsReceived> {
  const row = await db.getFirstAsync<{ total: number; n: number }>(
    `SELECT COALESCE(-SUM(amount),0) AS total, COUNT(*) AS n
     FROM customer_ledger WHERE store_id=? AND type='payment' AND created_at>=?`, [storeId, since],
  );
  return { total: row?.total ?? 0, count: row?.n ?? 0 };
}
