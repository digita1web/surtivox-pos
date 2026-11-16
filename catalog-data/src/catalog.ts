import { createReadStream, readdirSync, type Dirent } from 'node:fs';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline';
import { loadTaxonomy } from './taxonomy.ts';
import { CatalogChecker, validateProduct } from './validate.ts';
import type { Issue, Product, Taxonomy } from './types.ts';

export function jsonlFiles(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const out: string[] = [];
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsonlFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(path);
  }
  return out;
}

export async function* readJsonl(path: string): AsyncGenerator<{ line: number; value: unknown; error?: string }> {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  let line = 0;
  for await (const text of rl) {
    line++;
    if (!text.trim()) continue;
    try {
      yield { line, value: JSON.parse(text) };
    } catch (e) {
      yield { line, value: undefined, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

export interface CatalogResult {
  taxonomy: Taxonomy;
  products: Product[];
  issues: Issue[];
  files: number;
  lines: number;
}

export async function loadCatalog(root: string, dataDir = join(root, 'data'), onProduct?: (p: Product) => void): Promise<CatalogResult> {
  const { taxonomy, issues } = loadTaxonomy(root);
  const products: Product[] = [];
  const checker = new CatalogChecker();
  const files = jsonlFiles(dataDir);
  let lines = 0;
  for (const path of files) {
    const file = relative(root, path);
    for await (const row of readJsonl(path)) {
      lines++;
      if (row.error !== undefined) {
        issues.push({ level: 'error', code: 'json_invalido', message: row.error, file, line: row.line });
        continue;
      }
      const at = { file, line: row.line };
      const result = validateProduct(row.value, taxonomy, at);
      issues.push(...result.issues);
      if (!result.product) continue;
      const cross = checker.add(result.product, at);
      issues.push(...cross);
      if (cross.some((i) => i.level === 'error')) continue;
      if (onProduct) onProduct(result.product);
      else products.push(result.product);
    }
  }
  return { taxonomy, products, issues, files: files.length, lines };
}

export function summarize(issues: readonly Issue[]): { errors: number; warnings: number; byCode: Map<string, number> } {
  const byCode = new Map<string, number>();
  let errors = 0;
  let warnings = 0;
  for (const i of issues) {
    if (i.level === 'error') errors++;
    else warnings++;
    byCode.set(`${i.level}:${i.code}`, (byCode.get(`${i.level}:${i.code}`) ?? 0) + 1);
  }
  return { errors, warnings, byCode };
}
