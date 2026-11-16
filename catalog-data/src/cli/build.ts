import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, summarize } from '../catalog.ts';
import { buildPackages } from '../package.ts';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const root = resolve(args.get('root') ?? fileURLToPath(new URL('../..', import.meta.url)));
const out = resolve(args.get('out') ?? 'catalog-dist');
const version = args.get('version');

if (!version || !/^\d{4}\.\d{2}\.\d{2}(?:-\d+)?$/.test(version)) {
  console.log('Uso: node catalog-data/src/cli/build.ts --version=AAAA.MM.DD[-N] [--out=carpeta] [--root=catalog-data] [--gzip=false]');
  process.exit(2);
}

const result = await loadCatalog(root);
const { errors, warnings } = summarize(result.issues);
if (errors > 0) {
  console.log(`No se compila: la validación tiene ${errors} errores. Ejecuta node catalog-data/src/cli/validate.ts para verlos.`);
  process.exit(1);
}
if (result.products.length === 0) {
  console.log('No se compila: no hay productos válidos.');
  process.exit(1);
}

const manifest = buildPackages(out, result.products, result.taxonomy, { catalogVersion: version, gzip: args.get('gzip') !== 'false' });
for (const p of manifest.packages) console.log(`${p.id}: ${p.items} productos · ${p.bytes} bytes · sha256 ${p.sha256}${p.gzip_bytes ? ` · gzip ${p.gzip_bytes} bytes` : ''}`);
console.log(`Catálogo ${version}: ${result.products.length} productos, ${manifest.packages.length} paquetes, ${warnings} avisos. Salida: ${out}`);
