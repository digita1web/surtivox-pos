import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloudCardSubtitle } from './cloudCardText.ts';

test('la tarjeta solo dice sincronizado cuando ya hubo una sincronización', () => {
  assert.equal(cloudCardSubtitle(true, 1_700_000_000_000), 'Tu negocio está respaldado y sincronizado');
  assert.equal(cloudCardSubtitle(true, null), 'Activado, pero aún no se ha sincronizado');
});

test('sin la nube activa la tarjeta invita a activarla, aunque quede una fecha guardada', () => {
  assert.equal(cloudCardSubtitle(false, null), 'Respalda y sincroniza tu negocio entre dispositivos');
  assert.equal(cloudCardSubtitle(false, 1_700_000_000_000), 'Respalda y sincroniza tu negocio entre dispositivos');
});

test('Más usa ese texto y el hook entrega la fecha de la última sincronización', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.match(read('../app/(tabs)/more.tsx'), /cloudCardSubtitle\(cloud\.active, cloud\.syncedAt\)/);
  assert.match(read('./useCloudConnected.ts'), /setSyncedAt\(state\.last_synced_at\)/);
});
