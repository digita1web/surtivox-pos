import type { SaleOpsDatabase } from './saleOps.ts';

export interface CountReportFilter {
  from: number;
  to: number;
  staffId?: string | null;
}

export interface DiffTotals {
  shortUnits: number;
  shortValue: number;
  overUnits: number;
  overValue: number;
}

export interface ProductDiff extends DiffTotals {
  productId: string;
  name: string;
}

export interface CountSummary extends DiffTotals {
  countId: string;
  startedAt: number;
  closedAt: number | null;
  staffName: string | null;
  products: number;
}

export interface CountReport {
  products: ProductDiff[];
  counts: CountSummary[];
  totals: DiffTotals & { productsCounted: number; counts: number };
}

export interface CountStaff {
  id: string;
  name: string;
}

interface LineRow {
  count_id: string;
  started_at: number;
  closed_at: number | null;
  staff_name: string | null;
  product_id: string;
  product_name_snapshot: string;
  expected_qty: number;
  counted_qty: number;
  unit_cost: number;
}

const zero = (): DiffTotals => ({ shortUnits: 0, shortValue: 0, overUnits: 0, overValue: 0 });

function addNet(target: DiffTotals, units: number, value: number): void {
  if (units < 0) {
    target.shortUnits += -units;
    target.shortValue += Math.abs(value);
  } else if (units > 0) {
    target.overUnits += units;
    target.overValue += Math.abs(value);
  }
}

export function buildCountReport(rows: readonly LineRow[]): CountReport {
  const nets = new Map<string, { count: string; product: string; name: string; units: number; value: number }>();
  const counts = new Map<string, CountSummary>();
  for (const r of rows) {
    const delta = r.counted_qty - r.expected_qty;
    const key = `${r.count_id}\u0000${r.product_id}`;
    const net = nets.get(key) ?? { count: r.count_id, product: r.product_id, name: r.product_name_snapshot, units: 0, value: 0 };
    net.units += delta;
    net.value += delta * Math.max(0, r.unit_cost);
    net.name = r.product_name_snapshot;
    nets.set(key, net);
    if (!counts.has(r.count_id)) {
      counts.set(r.count_id, { countId: r.count_id, startedAt: r.started_at, closedAt: r.closed_at, staffName: r.staff_name, products: 0, ...zero() });
    }
  }
  const products = new Map<string, ProductDiff>();
  const totals = { ...zero(), productsCounted: 0, counts: counts.size };
  const counted = new Set<string>();
  for (const net of nets.values()) {
    const summary = counts.get(net.count)!;
    summary.products += 1;
    counted.add(net.product);
    addNet(summary, net.units, net.value);
    addNet(totals, net.units, net.value);
    if (net.units === 0) continue;
    const p = products.get(net.product) ?? { productId: net.product, name: net.name, ...zero() };
    p.name = net.name;
    addNet(p, net.units, net.value);
    products.set(net.product, p);
  }
  totals.productsCounted = counted.size;
  return {
    products: [...products.values()].sort((a, b) => b.shortValue - a.shortValue || b.shortUnits - a.shortUnits || b.overValue - a.overValue || a.name.localeCompare(b.name)),
    counts: [...counts.values()].sort((a, b) => b.startedAt - a.startedAt),
    totals,
  };
}

export async function countReportOn(db: Pick<SaleOpsDatabase, 'getAllAsync'>, storeId: string, filter: CountReportFilter): Promise<CountReport> {
  const params: (string | number)[] = [storeId, filter.from, filter.to];
  let staffSql = '';
  if (filter.staffId === null) staffSql = ' AND c.staff_id IS NULL';
  else if (filter.staffId !== undefined) {
    staffSql = ' AND c.staff_id = ?';
    params.push(filter.staffId);
  }
  const rows = await db.getAllAsync<LineRow>(
    `SELECT l.count_id, c.started_at, c.closed_at, st.name AS staff_name, l.product_id, l.product_name_snapshot,
            l.expected_qty, l.counted_qty, l.unit_cost
     FROM stock_count_lines l
     JOIN stock_counts c ON c.id = l.count_id
     LEFT JOIN staff st ON st.id = c.staff_id
     WHERE c.store_id = ? AND l.created_at >= ? AND l.created_at < ?${staffSql}
     ORDER BY l.created_at ASC, l.id ASC`,
    params,
  );
  return buildCountReport(rows);
}

export async function countStaffOn(db: Pick<SaleOpsDatabase, 'getAllAsync'>, storeId: string): Promise<CountStaff[]> {
  return db.getAllAsync<CountStaff>(
    `SELECT DISTINCT st.id, st.name FROM stock_counts c JOIN staff st ON st.id = c.staff_id
     WHERE c.store_id = ? AND EXISTS (SELECT 1 FROM stock_count_lines l WHERE l.count_id = c.id)
     ORDER BY st.name`,
    [storeId],
  );
}

export interface ReportTextOptions {
  storeName: string;
  periodLabel: string;
  staffLabel: string;
  money: (minor: number) => string;
  maxLines?: number;
}

export const NEUTRAL_NOTE =
  'Las diferencias pueden venir de ventas sin registrar, mermas, productos dañados o errores de conteo o de registro. Sirven para revisar el inventario.';

const units = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

export function countReportText(report: CountReport, opts: ReportTextOptions): string {
  const max = opts.maxLines ?? 25;
  const t = report.totals;
  const out = [
    `Conteo de inventario · ${opts.storeName}`,
    `Periodo: ${opts.periodLabel} · Conteo hecho por: ${opts.staffLabel}`,
    `Productos contados: ${t.productsCounted} en ${t.counts} conteo${t.counts === 1 ? '' : 's'}`,
    `Faltante: ${units(t.shortUnits)} · ${opts.money(t.shortValue)} a costo`,
    `Sobrante: ${units(t.overUnits)} · ${opts.money(t.overValue)} a costo`,
  ];
  const section = (title: string, list: ProductDiff[], pick: (p: ProductDiff) => [number, number]) => {
    if (list.length === 0) return;
    out.push('', title);
    for (const p of list.slice(0, max)) {
      const [u, v] = pick(p);
      out.push(`- ${p.name}: ${units(u)} · ${opts.money(v)}`);
    }
    if (list.length > max) out.push(`… y ${list.length - max} más`);
  };
  section('Faltantes', report.products.filter((p) => p.shortUnits > 0), (p) => [p.shortUnits, p.shortValue]);
  section('Sobrantes', [...report.products].filter((p) => p.overUnits > 0).sort((a, b) => b.overValue - a.overValue), (p) => [p.overUnits, p.overValue]);
  if (t.productsCounted > 0 && t.shortUnits === 0 && t.overUnits === 0) out.push('', 'Todo lo contado coincide con el sistema.');
  out.push('', NEUTRAL_NOTE);
  return out.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function countReportHtml(report: CountReport, opts: ReportTextOptions & { dateOf: (ms: number) => string }): string {
  const t = report.totals;
  const rows = (list: ProductDiff[], pick: (p: ProductDiff) => [number, number]) => list.map((p) => {
    const [u, v] = pick(p);
    return `<tr><td>${esc(p.name)}</td><td class="n">${u}</td><td class="n">${esc(opts.money(v))}</td></tr>`;
  }).join('');
  const table = (title: string, list: ProductDiff[], pick: (p: ProductDiff) => [number, number]) => list.length === 0 ? '' :
    `<h2>${title}</h2><table><thead><tr><th>Producto</th><th class="n">Unidades</th><th class="n">Valor a costo</th></tr></thead><tbody>${rows(list, pick)}</tbody></table>`;
  const short = report.products.filter((p) => p.shortUnits > 0);
  const over = report.products.filter((p) => p.overUnits > 0).sort((a, b) => b.overValue - a.overValue);
  const counts = report.counts.map((c) => `<tr><td>${esc(opts.dateOf(c.startedAt))}</td><td>${esc(c.staffName ?? 'Sin empleado')}</td><td class="n">${c.products}</td>` +
    `<td class="n">${c.shortUnits} · ${esc(opts.money(c.shortValue))}</td><td class="n">${c.overUnits} · ${esc(opts.money(c.overValue))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#102A24;margin:28px;font-size:12px}
h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 6px}
p{margin:2px 0;color:#41524C}table{width:100%;border-collapse:collapse;margin-top:4px}
th,td{border-bottom:1px solid #E5ECE8;padding:5px 4px;text-align:left}th{color:#5E6C67;font-weight:600}
.n{text-align:right;white-space:nowrap}.box{display:flex;gap:12px;margin-top:12px}
.box div{flex:1;border:1px solid #E5ECE8;border-radius:8px;padding:8px}.note{margin-top:18px;color:#5E6C67}
</style></head><body>
<h1>Conteo de inventario · ${esc(opts.storeName)}</h1>
<p>Periodo: ${esc(opts.periodLabel)} · Conteo hecho por: ${esc(opts.staffLabel)}</p>
<p>Productos contados: ${t.productsCounted} en ${t.counts} conteo${t.counts === 1 ? '' : 's'}</p>
<div class="box"><div><b>Faltante</b><br/>${units(t.shortUnits)} · ${esc(opts.money(t.shortValue))} a costo</div>
<div><b>Sobrante</b><br/>${units(t.overUnits)} · ${esc(opts.money(t.overValue))} a costo</div></div>
${table('Faltantes por producto', short, (p) => [p.shortUnits, p.shortValue])}
${table('Sobrantes por producto', over, (p) => [p.overUnits, p.overValue])}
${counts ? `<h2>Por conteo</h2><table><thead><tr><th>Fecha</th><th>Conteo hecho por</th><th class="n">Productos</th><th class="n">Faltante</th><th class="n">Sobrante</th></tr></thead><tbody>${counts}</tbody></table>` : ''}
<p class="note">${esc(NEUTRAL_NOTE)}</p>
</body></html>`;
}
