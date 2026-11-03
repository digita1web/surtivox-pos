import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, SYNC_TABLES, upsertSql, rowValues, changedSinceSql } from '@surtivox/database';
import { NUMBERED_TABLES, disambiguate, incomingLoses, resolveNumberCollision, type CollisionDatabase } from './numberCollision.ts';

type Param = string | number | null;
type Row = Record<string, unknown>;

function device(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  const now = Date.now();
  db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s1', 'Tienda', 'COP', 'es-CO', 0, now, now, 'd');
  return db;
}

function adapter(db: DatabaseSync): CollisionDatabase {
  return {
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      db.prepare(sql).run(...params);
      return {};
    },
  } as unknown as CollisionDatabase;
}

function addSale(db: DatabaseSync, id: string, invoice: string, createdAt: number): void {
  db.prepare("INSERT INTO sales (id,store_id,invoice_no,status,subtotal,grand_total,sold_at,created_at,updated_at,device_id) VALUES (?,'s1',?,'completed',100,100,?,?,?,'d')")
    .run(id, invoice, createdAt, createdAt, createdAt);
}

async function pull(db: DatabaseSync, rows: Row[]): Promise<void> {
  const a = adapter(db);
  const t = SYNC_TABLES.find((x) => x.name === 'sales')!;
  const numbered = NUMBERED_TABLES.find((n) => n.table === 'sales')!;
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const row of rows) {
    await resolveNumberCollision(a, numbered.table, numbered.column, row);
    db.prepare(upsertSql(t)).run(...(rowValues(t, row) as Param[]));
  }
}

function pushed(db: DatabaseSync): Row[] {
  const t = SYNC_TABLES.find((x) => x.name === 'sales')!;
  return db.prepare(changedSinceSql(t)).all(0) as Row[];
}

const numbers = (db: DatabaseSync) => (db.prepare('SELECT id, invoice_no FROM sales ORDER BY id').all() as { id: string; invoice_no: string }[])
  .map((r) => `${r.id}:${r.invoice_no}`);

test('two devices that issued the same invoice number converge without blocking the pull', async () => {
  const a = device();
  const b = device();
  addSale(a, 'aaaa1111', 'INV-0005', 1000);
  addSale(b, 'bbbb2222', 'INV-0005', 2000);

  await pull(a, pushed(b));
  await pull(b, pushed(a));

  assert.deepEqual(numbers(a), numbers(b));
  assert.deepEqual(numbers(a), ['aaaa1111:INV-0005', 'bbbb2222:INV-0005-BBBB']);
});

test('pulling the same rows again is idempotent', async () => {
  const a = device();
  const b = device();
  addSale(a, 'aaaa1111', 'INV-0005', 1000);
  addSale(b, 'bbbb2222', 'INV-0005', 2000);
  await pull(a, pushed(b));
  const before = numbers(a);
  await pull(a, pushed(b));
  await pull(a, pushed(b));
  assert.deepEqual(numbers(a), before);
});

test('a server round trip keeps both devices equal when the loser arrives first', async () => {
  const a = device();
  const b = device();
  addSale(a, 'aaaa1111', 'INV-0005', 1000);
  addSale(b, 'bbbb2222', 'INV-0005', 2000);
  await pull(b, pushed(a));
  await pull(a, pushed(b));
  await pull(b, pushed(a));
  await pull(a, pushed(b));
  assert.deepEqual(numbers(a), numbers(b));
});

test('equal timestamps break the tie by id, and non colliding rows are untouched', async () => {
  assert.equal(incomingLoses({ id: 'b', created_at: 5 }, { id: 'a', created_at: 5 }), true);
  assert.equal(incomingLoses({ id: 'a', created_at: 5 }, { id: 'b', created_at: 5 }), false);
  assert.equal(disambiguate('INV-0001', 'ab-cd-ef-12'), 'INV-0001-ABCD');
  const a = device();
  addSale(a, 'aaaa1111', 'INV-0001', 1000);
  await pull(a, [{ id: 'cccc3333', store_id: 's1', invoice_no: 'INV-0002', status: 'completed', subtotal: 1, discount_total: 0, tax_total: 0, grand_total: 1, sold_at: 1, created_at: 1, updated_at: 1, device_id: 'x', version: 1 }]);
  assert.deepEqual(numbers(a), ['aaaa1111:INV-0001', 'cccc3333:INV-0002']);
});

test('the same collision without resolution would abort the pull', () => {
  const a = device();
  const b = device();
  addSale(a, 'aaaa1111', 'INV-0005', 1000);
  addSale(b, 'bbbb2222', 'INV-0005', 2000);
  const t = SYNC_TABLES.find((x) => x.name === 'sales')!;
  const [row] = pushed(b);
  assert.throws(() => a.prepare(upsertSql(t)).run(...(rowValues(t, row!) as Param[])), /UNIQUE/);
});
