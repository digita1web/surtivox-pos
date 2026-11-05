import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';

type Param = string | number | null;

class FakeStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private readonly params: Param[];
  private readonly hook?: (sql: string) => void;
  constructor(db: DatabaseSync, sql: string, params: Param[] = [], hook?: (sql: string) => void) {
    this.db = db;
    this.sql = sql;
    this.params = params;
    this.hook = hook;
  }
  bind(...params: Param[]): FakeStatement { return new FakeStatement(this.db, this.sql, params, this.hook); }
  async first<T>(): Promise<T | null> { return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: this.db.prepare(this.sql).all(...this.params) as T[] }; }
  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    this.hook?.(this.sql);
    const result = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

export function fakeD1(db: DatabaseSync, hook?: (sql: string) => void) {
  return {
    prepare: (sql: string) => new FakeStatement(db, sql, [], hook),
    batch: async (statements: FakeStatement[]) => {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const statement of statements) out.push(await statement.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export function kitServer(hook?: (db: DatabaseSync, sql: string) => void) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const env = { DB: fakeD1(db, hook ? (sql) => hook(db, sql) : undefined) } as never;
  const call = async (path: string, token: string, body?: unknown, ip = '203.0.113.7') => {
    const res = await worker.fetch(new Request(`https://sync.test${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'CF-Connecting-IP': ip },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    const text = await res.text();
    return { status: res.status, headers: res.headers, text, body: JSON.parse(text) as Record<string, any> };
  };
  return { db, call };
}
