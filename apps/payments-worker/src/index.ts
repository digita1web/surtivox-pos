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

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function authorized(env: Pick<Env, 'DB'>, storeId: string, token: string): Promise<boolean> {
  const hash = await sha256Hex(token.trim());
  const key = await env.DB
    .prepare('SELECT store_id, key_hash FROM shop_keys WHERE key_hash=?')
    .bind(hash)
    .first<{ store_id: string; key_hash: string }>();
  if (key) return key.store_id === storeId && constantTimeEqual(key.key_hash, hash);
  const legacy = await env.DB
    .prepare('SELECT store_id FROM sync_tokens WHERE token=?')
    .bind(token.trim())
    .first<{ store_id: string }>();
  return legacy?.store_id === storeId;
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
