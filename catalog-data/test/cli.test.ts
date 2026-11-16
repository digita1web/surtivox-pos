import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, TEST_SOURCES, product } from './fixtures.ts';

const CLI = fileURLToPath(new URL('../src/cli/validate.ts', import.meta.url));

function workspace(lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'catalogo-'));
  cpSync(join(ROOT, 'taxonomy'), join(dir, 'taxonomy'), { recursive: true });
  mkdirSync(join(dir, 'sources'));
  cpSync(join(ROOT, 'sources/licenses.json'), join(dir, 'sources/licenses.json'));
  writeFileSync(join(dir, 'sources/sources.json'), JSON.stringify(TEST_SOURCES));
  mkdirSync(join(dir, 'data/prueba'), { recursive: true });
  writeFileSync(join(dir, 'data/prueba/a.jsonl'), lines.join('\n') + '\n');
  return dir;
}

function run(dir: string) {
  const r = spawnSync(process.execPath, ['--no-warnings', CLI, dir], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout + r.stderr };
}

test('un catálogo correcto valida con código 0 y cuenta los productos', () => {
  const r = run(workspace([JSON.stringify(product()), '', JSON.stringify(product({ id: 'prueba:panela', name: 'Panela 500 g', brand: 'La Abuela', barcodes: undefined, synonyms: undefined }))]));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /productos válidos: 2/);
  assert.match(r.out, /VALIDACIÓN OK \(0 avisos\)/);
});

test('un catálogo con errores termina en 1 y dice archivo, línea y motivo', () => {
  const r = run(workspace([JSON.stringify(product()), '{roto', JSON.stringify(product({ id: 'pendiente:x', source: { id: 'pendiente' }, license: 'CC0-1.0' })), JSON.stringify(product())]));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ERROR data\/prueba\/a\.jsonl:2 \[json_invalido\]/);
  assert.match(r.out, /ERROR data\/prueba\/a\.jsonl:3 \[fuente_no_aprobada\] pendiente:x/);
  assert.match(r.out, /ERROR data\/prueba\/a\.jsonl:4 \[id_duplicado\] prueba:arroz-diana-500/);
  assert.match(r.out, /productos válidos: 1/);
  assert.match(r.out, /VALIDACIÓN FALLÓ: 3 errores/);
});
