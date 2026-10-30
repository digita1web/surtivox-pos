# surtivox-sync

Cloudflare **Worker + D1** backend for Surtivox POS cloud sync.

The local SQLite database on each phone stays the source of truth. This service
is a reconcile point:

- **PUSH** — a device uploads rows it changed since its last push.
- **PULL** — a device downloads its store's rows changed since its last pull.

Mutable rows resolve by **last-writer-wins** (`updated_at`, then `version`);
event/ledger rows are **insert-if-absent** (idempotent). The reconcile logic is
shared with the app via `@surtivox/database` (`SYNC_TABLES`, `upsertSql`,
`pullSql`, …) and is covered by tests in `packages/database/test/` (run
`pnpm --filter @surtivox/database test`), including a full
device → server → device round-trip.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/health` | – | liveness |
| GET  | `/market-prices?ean=<8-14 digits>` | – | public VTEX reference prices |
| POST | `/sync/register` | Bearer token | bind a token to a store (idempotent) |
| POST | `/sync/push` | Bearer token | upsert uploaded rows for the token's store |
| GET  | `/sync/pull?since=<ms>` | Bearer token | rows changed after the cursor |

`/market-prices` es público, no usa el token de sincronización y solo consulta
los catálogos públicos de VTEX de Éxito, Jumbo y Olímpica. Valida EAN de 8 a 14
dígitos, limita a 30 solicitudes por minuto por cliente y conserva únicamente
coincidencias exactas de EAN con precio positivo. Las respuestas completas por
EAN se almacenan en la caché de borde durante 10 minutos; las respuestas con
errores parciales no se cachean para permitir reintentos.

Auth is a per-store **Bearer token**; the app generates one and the shopkeeper
shares it across their own devices. A token maps to exactly one store; a device
can only read/write its own store's rows.

## Deploy (do this when you're ready to go live)

From `apps/sync-worker/`:

```bash
pnpm install
pnpm wrangler login                 # your Cloudflare account

# 1. create the dedicated D1 database
pnpm db:create                      # prints a database_id
#    → paste that id into wrangler.toml (database_id = "...")

# 2. apply the schema to the remote D1
pnpm db:schema

# 3. deploy the Worker
pnpm deploy                         # prints https://surtivox-sync.<you>.workers.dev
```

Then in the app: **More → Cloud sync**, paste the Worker URL, tap **Generate**
for a token, and **Connect & sync**. On a second device, enter the same URL and
token and use **Restore this device from cloud**.

### Local dry run (no account changes)

```bash
pnpm db:schema:local
pnpm dev            # miniflare + local D1 at http://127.0.0.1:8787
curl http://127.0.0.1:8787/health
```

## Surtivox market-only Worker

The reference-price endpoint can be deployed independently from the Surtivox
sync Worker and without a D1 database:

```bash
pnpm dev:market
pnpm deploy:market
```

This uses `wrangler.market.toml` and `src/marketWorker.ts`, exposes only
`/health` and `/market-prices`, and reuses the same VTEX normalization code.

## Notes / ceilings

- Sync cursors are row timestamps with a 30s overlap, so brief clock skew
  between phones can only re-send a row (idempotent), never drop one. If you
  ever run many devices with badly unsynced clocks, switch to a server-assigned
  sequence column.
- `push` sends changed rows in one request. Fine for a shop's volume; chunk it
  if a single device ever has many thousands of unsynced rows.
- Product **images** are local files (not synced). Sync carries the catalog,
  sales, customers, credit, returns, purchases and staff — the data that matters
  for backup and multi-device. Re-add photos per device, or add image sync via
  R2 later.
