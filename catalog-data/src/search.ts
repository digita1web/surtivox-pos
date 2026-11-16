import { foldKey } from './normalize.ts';

export const MAX_QUERY_TOKENS = 6;

export function matchQuery(input: string): string | null {
  const tokens = foldKey(input).split(' ').filter(Boolean).slice(0, MAX_QUERY_TOKENS);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' ');
}

export function looksLikeBarcode(input: string): boolean {
  return /^\d{8,14}$/.test(input.trim());
}

export const SEARCH_CANDIDATES = 300;

export const SEARCH_SQL = `
SELECT p.id, p.name, p.brand, p.category_id, p.unit, p.pres_qty, p.pres_unit, p.pres_count
FROM (
  SELECT rowid AS rid, bm25(products_fts, 10.0, 4.0, 2.0) AS score
  FROM products_fts
  WHERE products_fts MATCH ?
  LIMIT ${SEARCH_CANDIDATES}
) c
JOIN products p ON p.rowid = c.rid
ORDER BY c.score, length(p.name), p.rowid
LIMIT ?`;

export const BARCODE_SQL = `
SELECT p.id, p.name, p.brand, p.category_id, p.unit, p.pres_qty, p.pres_unit, p.pres_count
FROM barcodes b JOIN products p ON p.rowid = b.product_rowid
WHERE b.code = ?`;
