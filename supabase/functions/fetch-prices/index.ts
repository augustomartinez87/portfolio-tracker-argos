
// Supabase Edge Function: fetch-prices
// Despliegue: supabase functions deploy fetch-prices --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuración de APIs externas
const APIS = {
    MEP: 'https://dolarapi.com/v1/dolares/bolsa',
    STOCKS: 'https://data912.com/live/arg_stocks',
    CEDEARS: 'https://data912.com/live/arg_cedears',
    BONDS: 'https://data912.com/live/arg_bonds',
    ON: 'https://data912.com/live/arg_corp'
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
    try {
        console.log("Starting price fetch job (v3 - Robust Parsing)...");
        const pricesToUpsert = [];
        const errors = [];

        // 1. Fetch MEP (Crítico - DolarAPI)
        try {
            const mepRes = await fetch(APIS.MEP);
            if (mepRes.ok) {
                const mepData = await mepRes.json();
                // DolarAPI devuelve números, pero aseguramos con Number()
                const price = Number(mepData.venta || mepData.promedio || 0);
                if (price > 0) {
                    pricesToUpsert.push({
                        ticker: 'MEP',
                        price: price,
                        panel: 'indicator',
                        last_update: new Date(),
                        metadata: { provider: 'dolarapi' }
                    });
                }
            }
        } catch (e) {
            console.error("Error fetching MEP:", e);
            errors.push(`MEP Error: ${e.message}`);
        }

        // 2. Fetch Data912 (Parallel)
        const sections = [
            { url: APIS.BONDS, panel: 'bonds' },
            { url: APIS.CEDEARS, panel: 'cedear' },
            { url: APIS.STOCKS, panel: 'arg_stock' },
            { url: APIS.ON, panel: 'corp' }
        ];

        const results = await Promise.allSettled(
            sections.map(s => fetch(s.url, { signal: AbortSignal.timeout(20000) }).then(r => r.json().then(d => ({ data: d, panel: s.panel }))))
        );

        let totalFetched = 0;

        results.forEach(res => {
            if (res.status === 'fulfilled') {
                const items = Array.isArray(res.value.data) ? res.value.data : [];
                totalFetched += items.length;

                items.forEach((item: any) => {
                    const ticker = item.symbol || item.ticker;

                    // DATA912: Prioridad a px_ask/bid si 'c' es 0 o nulo
                    // Coerción agresiva a Number() para evitar strings "123.45"
                    let rawPrice = Number(item.c);

                    // Si el cierre es 0, intentar con puntas (promedio o una de ellas)
                    if (!rawPrice || rawPrice === 0) {
                        const bid = Number(item.px_bid || item.bid);
                        const ask = Number(item.px_ask || item.ask);

                        if (bid > 0 && ask > 0) rawPrice = (bid + ask) / 2;
                        else if (ask > 0) rawPrice = ask; // Peor caso ask (compra)
                        else if (bid > 0) rawPrice = bid; // Peor caso bid (venta)
                        else rawPrice = Number(item.last || item.price || 0);
                    }

                    if (ticker && rawPrice > 0) {
                        pricesToUpsert.push({
                            ticker: ticker,
                            price: rawPrice, // Store RAW price (frontend handles /100 adj)
                            panel: res.value.panel,
                            last_update: new Date(),
                            metadata: {
                                pct_change: Number(item.pct_change || item.change || 0),
                                bid: Number(item.px_bid || item.bid || 0),
                                ask: Number(item.px_ask || item.ask || 0)
                            }
                        });
                    }
                });
            } else if (res.status === 'rejected') {
                console.error("Fetch failed for section:", res.reason);
                errors.push(`Section failed: ${res.reason}`);
            }
        });

        if (pricesToUpsert.length === 0) {
            return new Response(JSON.stringify({
                message: "No valid prices found",
                errors,
                totalFetched
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Upsert masivo a Supabase
        const BATCH_SIZE = 1000;
        for (let i = 0; i < pricesToUpsert.length; i += BATCH_SIZE) {
            const batch = pricesToUpsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from('market_prices')
                .upsert(batch, { onConflict: 'ticker' });

            if (error) throw error;
        }

        return new Response(
            JSON.stringify({
                message: `Success: Updated ${pricesToUpsert.length} prices`,
                total_scanned: totalFetched,
                errors: errors.length > 0 ? errors : undefined
            }),
            { headers: { 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
})
