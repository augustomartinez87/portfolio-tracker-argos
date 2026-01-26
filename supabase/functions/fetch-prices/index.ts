
// Supabase Edge Function: fetch-prices
// Despliegue: supabase functions deploy fetch-prices --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuración de APIs externas
const DATA912_BASE_URL = 'https://dolarapi.com/v1'; // Ejemplo placeholder, ajustar a la real si es diferente
// Nota: Usar las URLs reales de tu servicio de precios
const APIS = {
    MEP: 'https://dolarapi.com/v1/dolares/bolsa', // Fallback público confiable
    STOCKS: 'https://data912.com/live/arg_stocks',
    CEDEARS: 'https://data912.com/live/cedears',
    BONDS: 'https://data912.com/live/bonds',
    ON: 'https://data912.com/live/corp' // ONs
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
    try {
        console.log("Starting price fetch job...");
        const pricesToUpsert = [];

        // 1. Fetch MEP (Crítico)
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

        // 2. Fetch Data912 (Parallel) - Ajustar endpoints y mapeo según respuesta real de tu API
        // Este bloque es un esqueleto robusto.
        const sections = [
            { url: APIS.BONDS, panel: 'bonds' },
            { url: APIS.CEDEARS, panel: 'cedear' },
            { url: APIS.STOCKS, panel: 'merval' },
            { url: APIS.ON, panel: 'corp' }
        ];

        const results = await Promise.allSettled(
            sections.map(s => fetch(s.url, { signal: AbortSignal.timeout(10000) }).then(r => r.json().then(d => ({ data: d, panel: s.panel }))))
        );

        results.forEach(res => {
            if (res.status === 'fulfilled' && Array.isArray(res.value.data)) {
                res.value.data.forEach((item: any) => {
                    // Mapeo genérico (adaptar a la respuesta real JSON)
                    const ticker = item.symbol || item.ticker;
                    const price = item.c || item.last || item.price || 0; // 'c' suele ser close/last
                    const pct = item.pct_change || item.change || 0;

                    if (ticker && price > 0) {
                        pricesToUpsert.push({
                            ticker: ticker,
                            price: price,
                            panel: res.value.panel,
                            last_update: new Date(),
                            metadata: { pct_change: pct }
                        });
                    }
                });
            } else if (res.status === 'rejected') {
                console.error("Fetch failed for section:", res.reason);
            }
        });

        if (pricesToUpsert.length === 0) {
            return new Response(JSON.stringify({ message: "No prices fetched" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Upsert masivo a Supabase (Optimizadísimo)
        const { error } = await supabase
            .from('market_prices')
            .upsert(pricesToUpsert, { onConflict: 'ticker' });

        if (error) throw error;

        return new Response(
            JSON.stringify({ message: `Updated ${pricesToUpsert.length} prices`, timestamp: new Date() }),
            { headers: { 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
})
