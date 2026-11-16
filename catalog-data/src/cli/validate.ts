import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, summarize } from '../catalog.ts';

const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../..', import.meta.url)));
const maxShown = 50;

const result = await loadCatalog(root);
const { errors, warnings, byCode } = summarize(result.issues);

for (const issue of result.issues.slice(0, maxShown)) {
  const where = issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ''}` : 'taxonomía';
  console.log(`${issue.level === 'error' ? 'ERROR' : 'AVISO'} ${where} [${issue.code}]${issue.id ? ` ${issue.id}` : ''}: ${issue.message}`);
}
if (result.issues.length > maxShown) console.log(`… y ${result.issues.length - maxShown} más`);

console.log(`Archivos: ${result.files} · líneas: ${result.lines} · productos válidos: ${result.products.length}`);
console.log(`Fuentes aprobadas: ${[...result.taxonomy.sources.values()].filter((s) => s.status === 'approved').length} · categorías: ${result.taxonomy.categories.size} · unidades: ${result.taxonomy.units.size} · tipos de negocio: ${result.taxonomy.businessTypes.size}`);
for (const [code, n] of [...byCode].sort()) console.log(`  ${code}: ${n}`);
console.log(errors === 0 ? `VALIDACIÓN OK (${warnings} avisos)` : `VALIDACIÓN FALLÓ: ${errors} errores, ${warnings} avisos`);
process.exitCode = errors === 0 ? 0 : 1;
