import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  recoverEntryOnCloudScreen, showRecoverCardOnHome, showRecoverOnOnboarding, RECOVER_REPLACE_WARNING,
} from './recoverAccess.ts';
import { capabilityForPath } from './routeAccess.ts';

test('nube apagada: el acceso es un boton visible y principal, sin aviso de reemplazo previo', () => {
  assert.deepEqual(recoverEntryOnCloudScreen({ hosted: true, connected: false }), { visible: true, placement: 'primary', warnsReplace: false });
});

test('nube activa: queda como opcion secundaria con aviso de que reemplaza los datos', () => {
  assert.deepEqual(recoverEntryOnCloudScreen({ hosted: true, connected: true }), { visible: true, placement: 'secondary', warnsReplace: true });
  assert.match(RECOVER_REPLACE_WARNING, /Reemplaza todos los datos de este tel/);
});

test('sin respaldo alojado en la compilacion no se ofrece recuperar', () => {
  assert.deepEqual(recoverEntryOnCloudScreen({ hosted: false, connected: false }), { visible: false });
  assert.deepEqual(recoverEntryOnCloudScreen({ hosted: false, connected: true }), { visible: false });
  assert.equal(showRecoverOnOnboarding(false), false);
});

test('primer arranque: la tarjeta aparece siempre que haya respaldo alojado', () => {
  assert.equal(showRecoverOnOnboarding(true), true);
});

test('inicio sin datos: solo con tienda vacia, nube apagada, permiso de nube y respaldo alojado', () => {
  const base = { hosted: true, canSync: true, cloudConnected: false, productCount: 0, orderCount: 0 };
  assert.equal(showRecoverCardOnHome(base), true);
  assert.equal(showRecoverCardOnHome({ ...base, productCount: 1 }), false);
  assert.equal(showRecoverCardOnHome({ ...base, orderCount: 3 }), false);
  assert.equal(showRecoverCardOnHome({ ...base, cloudConnected: true }), false);
  assert.equal(showRecoverCardOnHome({ ...base, canSync: false }), false);
  assert.equal(showRecoverCardOnHome({ ...base, hosted: false }), false);
});

test('la ruta de recuperar exige el permiso de nube', () => {
  assert.equal(capabilityForPath('/recover'), 'sync');
});

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('las pantallas usan las condiciones de visibilidad centralizadas', () => {
  const cloud = read('../app/cloud-sync.tsx');
  const home = read('../app/(tabs)/index.tsx');
  const onboarding = read('./pos/Onboarding.tsx');
  assert.match(cloud, /recoverEntryOnCloudScreen\(/);
  assert.match(home, /showRecoverCardOnHome\(/);
  assert.match(onboarding, /showRecoverOnOnboarding\(/);
});

test('la pantalla de nube deja espacio inferior suficiente bajo el contenido', () => {
  const cloud = read('../app/cloud-sync.tsx');
  assert.match(cloud, /contentStyle=\{\{ paddingBottom: 160 \}\}/);
});
