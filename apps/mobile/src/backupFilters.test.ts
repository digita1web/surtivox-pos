import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { filterBackupRows, restoreDeleteSql } from './backupFilters.ts';
import { KIT_KEYS } from './kitOps.ts';

test('la copia no incluye ninguna clave del kit, y conserva el resto de configuraciones', () => {
  const rows = [
    ...Object.values(KIT_KEYS).map((key) => ({ key, value: 'secreto' })),
    { key: 'appearance', value: 'dark' },
  ];
  assert.deepEqual(filterBackupRows('local_settings', rows), [{ key: 'appearance', value: 'dark' }]);
  assert.deepEqual(filterBackupRows('products', [{ key: KIT_KEYS.entropy }]), [{ key: KIT_KEYS.entropy }]);
});

test('restaurar no borra el kit del dispositivo ni deja entrar uno ajeno', () => {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  const put = db.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)');
  put.run(KIT_KEYS.entropy, 'propio');
  put.run('appearance', 'dark');
  db.exec(restoreDeleteSql('local_settings'));
  const incoming = [{ key: KIT_KEYS.entropy, value: 'ajeno' }, { key: 'appearance', value: 'light' }];
  for (const row of filterBackupRows('local_settings', incoming)) put.run(row.key as string, row.value as string);
  const rows = db.prepare('SELECT key, value FROM local_settings ORDER BY key').all().map((row) => ({ ...row }));
  assert.deepEqual(rows, [{ key: 'appearance', value: 'light' }, { key: KIT_KEYS.entropy, value: 'propio' }]);
  assert.equal(restoreDeleteSql('products'), 'DELETE FROM "products"');
});

test('los borradores del asistente no viajan en las copias ni se pisan al restaurar', () => {
  const rows = [{ key: 'product_wizard_draft:7701234567897', value: '{}' }, { key: 'appearance', value: 'dark' }];
  assert.deepEqual(filterBackupRows('local_settings', rows), [{ key: 'appearance', value: 'dark' }]);
  assert.match(restoreDeleteSql('local_settings'), /NOT LIKE 'product_wizard_draft:%'/);
});
