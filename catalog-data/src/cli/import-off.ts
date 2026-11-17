import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformOff, type CategoryRule, type Exclusion, type OffRaw } from '../importers/off.ts';
import { loadTaxonomy } from '../taxonomy.ts';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const root = resolve(args.get('root') ?? fileURLToPath(new URL('../..', import.meta.url)));
const day = args.get('day');
if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.log('Uso: node catalog-data/src/cli/import-off.ts --day=AAAA-MM-DD [--root=catalog-data]');
  process.exit(2);
}

const cache = join(root, '.cache/off', day);
const meta = JSON.parse(readFileSync(join(cache, 'meta.json'), 'utf8')) as { count: number; pages: number };
const rules = JSON.parse(readFileSync(join(root, 'src/importers/off-categories.json'), 'utf8')) as CategoryRule[];
const excluded = new Set((JSON.parse(readFileSync(join(root, 'src/importers/off-exclusions.json'), 'utf8')) as Exclusion[]).map((e) => e.code));
const { taxonomy, issues } = loadTaxonomy(root);
if (issues.length) throw new Error(`Taxonomía inválida: ${JSON.stringify(issues)}`);
for (const r of rules) if (!taxonomy.categories.has(r.category)) throw new Error(`off-categories.json usa una categoría inexistente: ${r.category}`);

const seen = new Set<string>();
const accepted: Record<string, unknown>[] = [];
const quarantine: { code: unknown; reason: string; detail?: string; name?: unknown; brands?: unknown; categories?: unknown }[] = [];
let rawCount = 0;
for (const file of readdirSync(cache).filter((f) => /^page-\d{3}\.json$/.test(f)).sort()) {
  const page = JSON.parse(readFileSync(join(cache, file), 'utf8')) as { products: OffRaw[] };
  for (const raw of page.products) {
    rawCount++;
    const code = typeof raw.code === 'string' ? raw.code : '';
    if (seen.has(code)) continue;
    seen.add(code);
    const r = transformOff(raw, rules, taxonomy, day, excluded);
    if (r.ok) accepted.push(r.product);
    else {
      const entry: (typeof quarantine)[number] = { code: raw.code, reason: r.reason, name: raw.product_name_es || raw.product_name, brands: raw.brands, categories: raw.categories_tags };
      if (r.detail !== undefined) entry.detail = r.detail;
      quarantine.push(entry);
    }
  }
}

accepted.sort((a, b) => ((a['id'] as string) < (b['id'] as string) ? -1 : 1));
const outDir = join(root, 'data/off');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'colombia.jsonl'), accepted.map((p) => JSON.stringify(p)).join('\n') + '\n');
writeFileSync(join(cache, 'quarantine.jsonl'), quarantine.map((q) => JSON.stringify(q)).join('\n') + '\n');

const reasons = new Map<string, number>();
for (const q of quarantine) reasons.set(q.reason, (reasons.get(q.reason) ?? 0) + 1);
const byCategory = new Map<string, number>();
for (const p of accepted) byCategory.set(p['category'] as string, (byCategory.get(p['category'] as string) ?? 0) + 1);

console.log(`Open Food Facts ${day}: ${meta.count} anunciados, ${rawCount} recibidos, ${seen.size} códigos únicos`);
console.log(`Aceptados: ${accepted.length} · en cuarentena: ${quarantine.length}`);
console.log('Cuarentena por motivo:');
for (const [k, v] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
console.log('Aceptados por categoría:');
for (const [k, v] of [...byCategory].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
