// Supabase Edge Function: fetch-crypto-prices
// Despliegue: supabase functions deploy fetch-crypto-prices --no-verify-jwt

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Cache-Control': 'public, max-age=30'
    }
  });
}

async function parseBody(req: Request) {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    return params;
  }

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await req.json();
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200);
  }

  try {
    const payload = await parseBody(req);
    const type = String(payload.type || '').toLowerCase();

    if (type === 'simple') {
      const ids = Array.isArray(payload.ids)
        ? payload.ids
        : String(payload.ids || '').split(',').map((id) => id.trim()).filter(Boolean);
      const vsCurrency = String(payload.vs_currency || payload.vsCurrency || 'usdt').toLowerCase();
      const include24h = String(payload.include_24hr_change ?? payload.include24h ?? 'true') === 'true';

      if (!ids.length) return jsonResponse({ data: {} });

      const url = new URL(`${COINGECKO_BASE_URL}/simple/price`);
      url.searchParams.set('ids', ids.join(','));
      url.searchParams.set('vs_currencies', vsCurrency);
      url.searchParams.set('include_24hr_change', include24h ? 'true' : 'false');

      const res = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'user-agent': 'argos-capital/1.0'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        return jsonResponse({ error: `CoinGecko error ${res.status}: ${text}` }, 500);
      }

      const data = await res.json();
      return jsonResponse({ data });
    }

    if (type === 'markets') {
      const vsCurrency = String(payload.vs_currency || payload.vsCurrency || 'usdt').toLowerCase();
      const perPage = Number(payload.per_page || payload.perPage || 10);
      const page = Number(payload.page || 1);
      const order = String(payload.order || 'market_cap_desc');

      const url = new URL(`${COINGECKO_BASE_URL}/coins/markets`);
      url.searchParams.set('vs_currency', vsCurrency);
      url.searchParams.set('order', order);
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('page', String(page));

      const res = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'user-agent': 'argos-capital/1.0'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        return jsonResponse({ error: `CoinGecko error ${res.status}: ${text}` }, 500);
      }

      const data = await res.json();
      return jsonResponse({ data });
    }

    if (type === 'list') {
      const url = new URL(`${COINGECKO_BASE_URL}/coins/list`);
      
      const res = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'user-agent': 'argos-capital/1.0'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        return jsonResponse({ error: `CoinGecko error ${res.status}: ${text}` }, 500);
      }

      const data = await res.json();
      return jsonResponse({ data });
    }

    return jsonResponse({ error: 'Invalid type. Use type=simple, type=markets, or type=list.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
