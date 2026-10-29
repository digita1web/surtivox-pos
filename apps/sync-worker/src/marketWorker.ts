import { handleMarketPrices } from './marketPrices.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'surtivox-market' });
    }
    if (url.pathname === '/market-prices') {
      return handleMarketPrices(req);
    }
    return json({ ok: false, error: 'not_found' }, 404);
  },
};
