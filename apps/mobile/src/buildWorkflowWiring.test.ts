import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const build = read('../../../.github/workflows/build-android.yml');
const pages = read('../../../.github/workflows/pages.yml');

test('el build de una etiqueta valida la versión contra app.json antes de compilar', () => {
  const validate = build.indexOf('node scripts/check-release-tag.mjs "${GITHUB_REF_NAME}"');
  assert.ok(validate > 0);
  assert.ok(validate < build.indexOf('name: Build release APK'));
  assert.match(build, /if: github\.ref_type == 'tag'\n\s+run: node scripts\/check-release-tag\.mjs/);
});

function stepScript(name: string): string {
  const start = build.indexOf(`- name: ${name}\n`);
  assert.ok(start > 0, name);
  const next = build.indexOf('\n      - name:', start + 1);
  const block = build.slice(start, next < 0 ? undefined : next);
  const run = block.slice(block.indexOf('run: |\n') + 'run: |\n'.length);
  return run.split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');
}

function chosen(refType: string, allArchs: string): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'archs-'));
  const envFile = join(dir, 'github_env');
  writeFileSync(envFile, '');
  const result = spawnSync('bash', ['-c', stepScript('Elegir arquitecturas')], {
    env: { PATH: process.env.PATH ?? '', GITHUB_REF_TYPE: refType, ALL_ARCHS: allArchs, GITHUB_ENV: envFile },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const values: Record<string, string> = {};
  for (const line of readFileSync(envFile, 'utf8').split('\n').filter(Boolean)) {
    const split = line.indexOf('=');
    values[line.slice(0, split)] = line.slice(split + 1);
  }
  rmSync(dir, { recursive: true, force: true });
  return values;
}

test('las dos arquitecturas se compilan en las etiquetas y cuando se pide a mano; en el resto solo arm64', () => {
  const both = { ARCHS: 'arm64-v8a,armeabi-v7a', EXPECTED_ABIS: "'arm64-v8a' 'armeabi-v7a'" };
  const arm64 = { ARCHS: 'arm64-v8a', EXPECTED_ABIS: "'arm64-v8a'" };
  assert.deepEqual(chosen('tag', ''), both);
  assert.deepEqual(chosen('tag', 'false'), both);
  assert.deepEqual(chosen('branch', 'true'), both);
  assert.deepEqual(chosen('branch', 'false'), arm64);
  assert.deepEqual(chosen('branch', ''), arm64);
});

test('el lanzamiento manual ofrece all_archs, apagado por defecto, y la decisión se toma en un solo paso', () => {
  assert.match(build, /workflow_dispatch:\n\s+inputs:\n\s+all_archs:\n[\s\S]*?type: boolean\n\s+default: false/);
  assert.match(build, /ALL_ARCHS: \$\{\{ inputs\.all_archs \}\}/);
  assert.equal((build.match(/"arm64-v8a,armeabi-v7a"/g) ?? []).length, 0);
  assert.equal((build.match(/ARCHS=arm64-v8a,armeabi-v7a/g) ?? []).length, 1);
  assert.ok(build.indexOf('name: Elegir arquitecturas') < build.indexOf('name: Build release APK'));
  assert.match(build, /-PreactNativeArchitectures="\$\{ARCHS\}"/);
  assert.match(build, /"\$\{ACTUAL\}" != "\$\{EXPECTED_ABIS\}"/);
});

test('un lanzamiento manual nunca publica un release: eso solo lo hacen las etiquetas', () => {
  assert.match(build, /if \[ "\$\{GITHUB_REF_TYPE\}" = "tag" \]; then\n\s+release=true/);
  assert.match(build, /needs\.plan\.outputs\.release == 'true' && needs\.build-android\.result == 'success'/);
});

test('el release solo se publica desde una etiqueta y renombra el APK al nombre que enlaza la página', () => {
  assert.match(build, /needs\.plan\.outputs\.release == 'true'/);
  assert.match(build, /mv release-apk\/app-release\.apk release-apk\/Surtivox\.apk/);
  assert.match(read('../../../landing/index.html'), /releases\/latest\/download\/Surtivox\.apk/);
  assert.match(read('../../../landing/app.js'), /PREFERRED_APK = 'Surtivox\.apk'/);
});

test('la página solo se vuelve a publicar cuando cambia landing o su workflow', () => {
  assert.match(pages, /paths:\n\s+- 'landing\/\*\*'\n\s+- '\.github\/workflows\/pages\.yml'/);
});
