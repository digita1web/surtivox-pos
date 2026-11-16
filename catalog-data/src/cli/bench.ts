import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { buildPackageDb, buildPackages, productsFor, type FtsDetail } from '../package.ts';
import { BARCODE_SQL, SEARCH_SQL, matchQuery } from '../search.ts';
import { SYNTHETIC_SOURCE, rng, syntheticProducts } from '../synthetic.ts';
import { buildTaxonomy, readTaxonomyFiles } from '../taxonomy.ts';
import { validateProduct } from '../validate.ts';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const items = Number(args.get('items') ?? 200_000);
const detail = (args.get('detail') ?? 'none') as FtsDetail;
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const ms = (n: number) => `${n.toFixed(n < 10 ? 2 : 0)} ms`;
const time = <T>(fn: () => T): [T, number] => { const t = performance.now(); const v = fn(); return [v, performance.now() - t]; };
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;

const files = readTaxonomyFiles(root);
const { taxonomy, issues } = buildTaxonomy({ ...files, sources: [SYNTHETIC_SOURCE] });
if (issues.length) throw new Error(JSON.stringify(issues));

const [products, genMs] = time(() => syntheticProducts(items, taxonomy));
const [invalid, valMs] = time(() => products.filter((p) => validateProduct(p, taxonomy).issues.some((i) => i.level === 'error')).length);
console.log(`Productos sintéticos: ${items} · generación ${ms(genMs)} · validación ${ms(valMs)} · inválidos ${invalid}`);
if (invalid) process.exit(1);

const out = mkdtempSync(join(tmpdir(), 'catalogo-bench-'));
const [manifest, buildMs] = time(() => buildPackages(out, products, taxonomy, { catalogVersion: 'bench', detail }));
console.log(`\nPaquetes (FTS5 detail=${detail}) · compilación ${ms(buildMs)}`);
console.log('| Paquete | Productos | SQLite | gzip -9 |');
console.log('|---|---:|---:|---:|');
for (const p of manifest.packages) console.log(`| ${p.id} | ${p.items} | ${mb(p.bytes)} | ${mb(p.gzip_bytes ?? 0)} |`);

const biggest = [...manifest.packages].sort((a, b) => b.items - a.items)[0]!;
const raw = readFileSync(join(out, biggest.file));
const [br, brMs] = time(() => brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }));
console.log(`\nBrotli 11 de ${biggest.id}: ${mb(br.length)} (${ms(brMs)}); gzip -9: ${mb(gzipSync(raw, { level: 9 }).length)}`);

if (args.has('compare')) {
  console.log('\nComparación de detail para el paquete más grande:');
  for (const d of ['none', 'column', 'full'] as const) {
    const path = join(out, `cmp-${d}.sqlite`);
    const [, t] = time(() => buildPackageDb(path, biggest.id, productsFor(biggest.id, products), taxonomy, { catalogVersion: 'bench', detail: d }));
    const bytes = readFileSync(path);
    console.log(`  detail=${d}: ${mb(bytes.length)} · gzip ${mb(gzipSync(bytes, { level: 9 }).length)} · ${ms(t)}`);
  }
}

const [db, openMs] = time(() => new DatabaseSync(join(out, biggest.file), { readOnly: true }));
const search = db.prepare(SEARCH_SQL);
const byCode = db.prepare(BARCODE_SQL);
const r = rng(7);
const subset = productsFor(biggest.id, products);
const queries: string[] = [];
for (let i = 0; i < 300; i++) {
  const name = subset[Math.floor(r() * subset.length)]!.name;
  const words = name.split(' ');
  for (let k = 1; k <= Math.min(words.length, 3); k++) {
    const typed = words.slice(0, k).join(' ');
    for (let c = 2; c <= typed.length; c += 2) queries.push(typed.slice(0, c));
  }
}
const lat: number[] = [];
let hits = 0;
for (const q of queries) {
  const match = matchQuery(q);
  if (!match) continue;
  const t = performance.now();
  hits += search.all(match, 30).length;
  lat.push(performance.now() - t);
}
lat.sort((a, b) => a - b);
const codes = subset.filter((p) => p.barcodes).slice(0, 500).map((p) => p.barcodes![0]!);
const codeLat: number[] = [];
for (const c of codes) {
  const t = performance.now();
  if (!byCode.get(c)) throw new Error(`código no encontrado ${c}`);
  codeLat.push(performance.now() - t);
}
codeLat.sort((a, b) => a - b);
db.close();
console.log(`\nConsultas en ${biggest.id} (${biggest.items} productos) · apertura ${ms(openMs)}`);
console.log(`  búsqueda mientras se escribe: ${lat.length} consultas · p50 ${ms(pct(lat, 0.5))} · p95 ${ms(pct(lat, 0.95))} · máx ${ms(lat[lat.length - 1]!)} · ${(hits / lat.length).toFixed(1)} resultados promedio`);
console.log(`  código de barras: ${codeLat.length} consultas · p50 ${ms(pct(codeLat, 0.5))} · p95 ${ms(pct(codeLat, 0.95))}`);
console.log('\nMedido en este equipo, no en un teléfono.');
rmSync(out, { recursive: true, force: true });
