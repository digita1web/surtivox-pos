import type { Migration } from '../runner.ts';

const sql = `
CREATE TABLE local_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const migration: Migration = { id: '0010_local_settings', sql };
