import {
  CLOUD_SYNC_AMOUNT_CENTS,
  CLOUD_SYNC_CURRENCY,
  CLOUD_SYNC_DAYS,
  checkoutUrl,
  createReference,
  integritySignature,
} from './wompi.ts';

interface D1Result {
  success: boolean;
  meta?: { changes?: number };
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(sql: string): D1Statement;
}

interface Env {
  DB: D1Database;
  WOMPI_PUBLIC_KEY?: string;
  WOMPI_PRIVATE_KEY?: string;
  WOMPI_INTEGRITY_SECRET?: string;
  WOMPI_EVENTS_SECRET?: string;
}

interface CreatePaymentBody {
  store_id?: unknown;
  token?: unknown;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

function validStoreId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function validToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 12 && value.trim().length <= 256;
}

async function authorized(env: Env, storeId: string, token: string): Promise<boolean> {
  const row = await env.DB
    .prepare('SELECT store_id FROM sync_tokens WHERE token=? AND store_id=?')
    .bind(token.trim(), storeId)
    .first<{ store_id: string }>();
  return row?.store_id === storeId;
}

async function createPayment(request: Request, env: Env): Promise<Response> {
  if (!env.WOMPI_PUBLIC_KEY || !env.WOMPI_INTEGRITY_SECRET) {
    return json({ error: 'payment_provider_unavailable' }, 503);
  }
  let body: CreatePaymentBody;
  try {
    body = await request.json() as CreatePaymentBody;
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (!validStoreId(body.store_id) || !validToken(body.token)) {
    return json({ error: 'invalid_request' }, 400);
  }
  if (!(await authorized(env, body.store_id, body.token))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const now = Date.now();
  const reference = createReference(now, crypto.randomUUID());
  const signature = await integritySignature(
    reference,
    CLOUD_SYNC_AMOUNT_CENTS,
    CLOUD_SYNC_CURRENCY,
    env.WOMPI_INTEGRITY_SECRET,
  );
  await env.DB.prepare(
    `INSERT INTO payment_intents
      (reference,store_id,amount_cents,currency,days,status,wompi_tx_id,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).bind(
    reference,
    body.store_id,
    CLOUD_SYNC_AMOUNT_CENTS,
    CLOUD_SYNC_CURRENCY,
    CLOUD_SYNC_DAYS,
    'pending',
    null,
    now,
  ).run();

  return json({
    reference,
    url: checkoutUrl(
      env.WOMPI_PUBLIC_KEY,
      reference,
      CLOUD_SYNC_AMOUNT_CENTS,
      CLOUD_SYNC_CURRENCY,
      signature,
    ),
  }, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'surtivox-pagos' });
    if (url.pathname === '/pagos/crear' && request.method === 'POST') return createPayment(request, env);
    return json({ error: 'not_found' }, 404);
  },
};
