
// Supabase Edge Function: fetch-prices
// Despliegue: supabase functions deploy fetch-prices --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuración de APIs externas (URLs REALES verificadas)
const APIS = {
    MEP: 'https://dolarapi.com/v1/dolares/bolsa',
    STOCKS: 'https://data912.com/live/arg_stocks',
    CEDEARS: 'https://data912.com/live/arg_cedears', // Verified: uses arg_cedears
    BONDS: 'https://data912.com/live/arg_bonds',
    ON: 'https://data912.com/live/arg_corp' // Verified: uses arg_corp
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
    try {
        console.log("Starting price fetch job (v2)...");
        const pricesToUpsert = [];

        // 1. Fetch MEP (Crítico - DolarAPI)
        try {
            const mepRes = await fetch(APIS.MEP);
            if (mepRes.ok) {
                const mepData = await mepRes.json();
                const price = mepData.venta || mepData.promedio || 0;
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
        }

        // 2. Fetch Data912 (Parallel)
        const sections = [
            { url: APIS.BONDS, panel: 'bonds' },
            { url: APIS.CEDEARS, panel: 'cedear' },
            { url: APIS.STOCKS, panel: 'arg_stock' }, // Correct panel name
            { url: APIS.ON, panel: 'corp' }
        ];

        const results = await Promise.allSettled(
            sections.map(s => fetch(s.url, { signal: AbortSignal.timeout(15000) }).then(r => r.json().then(d => ({ data: d, panel: s.panel }))))
        );

        results.forEach(res => {
            if (res.status === 'fulfilled' && Array.isArray(res.value.data)) {
                res.value.data.forEach((item: any) => {
                    // Mapeo flexible para Data912
                    const ticker = item.symbol || item.ticker;

                    // DATA912 return formats:
                    // Stocks/Cedears: { symbol, c (close), px_bid, px_ask ... }
                    // Bonds: { symbol, c, ... }
                    // Need to handle potential differing keys if API changse
                    const price = item.c || item.px_ask || item.px_bid || item.last || item.price || 0;

                    const pct = item.pct_change || item.change || 0;

                    if (ticker && price > 0) {
                        pricesToUpsert.push({
                            ticker: ticker,
                            price: Number(price),
                            panel: res.value.panel,
                            last_update: new Date(),
                            metadata: {
                                pct_change: pct,
                                bid: item.px_bid || item.bid,
                                ask: item.px_ask || item.ask
                            }
                        });
                    }
                });
            } else if (res.status === 'rejected') {
                console.error("Fetch failed for section:", res.reason);
            }
        });

        if (pricesToUpsert.length === 0) {
            return new Response(JSON.stringify({ message: "No prices fetched from any source" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Upsert masivo a Supabase (Batched to avoid timeouts if list is huge)
        // Batch size 1000 is safe for Supabase
        const BATCH_SIZE = 1000;
        for (let i = 0; i < pricesToUpsert.length; i += BATCH_SIZE) {
            const batch = pricesToUpsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from('market_prices')
                .upsert(batch, { onConflict: 'ticker' });

            if (error) {
                console.error("Error upserting batch:", error);
                throw error;
            }
        }

        return new Response(
            JSON.stringify({ message: `Updated ${pricesToUpsert.length} prices`, timestamp: new Date() }),
            { headers: { 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
})
