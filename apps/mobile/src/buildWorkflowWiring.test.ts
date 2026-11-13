import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const build = read('../../../.github/workflows/build-android.yml');
const pages = read('../../../.github/workflows/pages.yml');

test('el build de una etiqueta valida la versión contra app.json antes de compilar', () => {
  const validate = build.indexOf('node scripts/check-release-tag.mjs "${GITHUB_REF_NAME}"');
  assert.ok(validate > 0);
  assert.ok(validate < build.indexOf('name: Build release APK'));
  assert.match(build, /if: github\.ref_type == 'tag'\n\s+run: node scripts\/check-release-tag\.mjs/);
});

test('las dos arquitecturas se compilan solo en las etiquetas y la entrega verifica lo que trae el APK', () => {
  assert.match(build, /if \[ "\$\{GITHUB_REF_TYPE\}" = "tag" \]; then\n\s+ARCHS="arm64-v8a,armeabi-v7a"\n\s+else\n\s+ARCHS="arm64-v8a"/);
  assert.match(build, /-PreactNativeArchitectures="\$\{ARCHS\}"/);
  assert.match(build, /EXPECTED="'arm64-v8a' 'armeabi-v7a'"/);
  assert.match(build, /EXPECTED="'arm64-v8a'"/);
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
