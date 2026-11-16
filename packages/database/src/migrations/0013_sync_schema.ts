import type { Migration } from '../runner.ts';

const sql = `
ALTER TABLE sync_state ADD COLUMN synced_schema INTEGER NOT NULL DEFAULT 1;
`;

export const migration: Migration = { id: '0013_sync_schema', sql };
