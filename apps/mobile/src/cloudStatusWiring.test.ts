import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = read('../app/(tabs)/index.tsx');
const more = read('../app/(tabs)/more.tsx');
const cloudScreen = read('../app/cloud-sync.tsx');
const hook = read('./useCloudConnected.ts');

test('Inicio y Más leen el estado de la nube del mismo hook, basado en la configuración de sincronización', () => {
  for (const screen of [home, more]) {
    assert.match(screen, /import \{ useCloudConnected \} from '\.\.\/\.\.\/src\/useCloudConnected'/);
    assert.match(screen, /const cloud = useCloudConnected\(\)/);
    assert.doesNotMatch(screen, /useCloudEntitlement/);
  }
  assert.match(hook, /isConfigured\(state\)/);
  assert.match(cloudScreen, /isConfigured\(state\)/);
});

test('ninguna pantalla activa fuera de la ruta heredada del paywall depende de la compra dentro de la app', () => {
  const dirs = ['../app', '../app/(tabs)', '../app/customer', '../app/sale'];
  const offenders: string[] = [];
  for (const dir of dirs) {
    let names: string[] = [];
    try { names = readdirSync(new URL(`${dir}/`, import.meta.url)); } catch { continue; }
    for (const name of names.filter((n) => n.endsWith('.tsx') && n !== 'paywall.tsx')) {
      if (/src\/subscription'/.test(read(`${dir}/${name}`))) offenders.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});
