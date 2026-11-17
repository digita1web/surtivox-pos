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

test('el cobro heredado ya no existe: sin paywall, sin suscripción, sin expo-iap', async () => {
  const { existsSync, readdirSync: list } = await import('node:fs');
  for (const path of ['../app/paywall.tsx', './subscription.ts', './payments.ts']) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
  }
  const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies['expo-iap'], undefined);
  assert.doesNotMatch(read('../app.json'), /expo-iap/);
  const dirs = ['../app', '../app/(tabs)', '../app/customer', '../app/sale', './', './pos'];
  const offenders: string[] = [];
  for (const dir of dirs) {
    for (const name of list(new URL(`${dir}/`, import.meta.url)).filter((n) => /\.tsx?$/.test(n) && !n.endsWith('.test.ts'))) {
      if (/expo-iap|\/subscription'|\/payments'|paywall/.test(read(`${dir}/${name}`))) offenders.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});
