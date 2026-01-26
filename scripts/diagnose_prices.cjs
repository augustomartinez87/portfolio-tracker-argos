
// scripts/diagnose_prices.js
// Ejecutar con: node scripts/diagnose_prices.cjs

// Using native fetch (Node 18+)

async function checkUrl(name, url) {
    console.log(`\n--- Checking ${name} (${url}) ---`);
    try {
        const start = Date.now();
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const duration = Date.now() - start;

        if (!res.ok) {
            console.error(`ERROR: HTTP ${res.status} - ${res.statusText}`);
            return;
        }

        const data = await res.json();
        console.log(`Success! Time: ${duration}ms. Items: ${Array.isArray(data) ? data.length : 'Not an array'}`);

        if (Array.isArray(data) && data.length > 0) {
            console.log("Sample Item Structure:", JSON.stringify(data[0], null, 2));

            // Buscar tickers problemáticos
            const problematic = ['AAPL', 'MSFT', 'TTD26', 'GOOGL', 'VALE'];
            const found = data.filter(i => {
                const t = (i.symbol || i.ticker || '').toUpperCase();
                return problematic.includes(t);
            });

            if (found.length > 0) {
                console.log("\nFOUND Problematic Tickers in this section:");
                found.forEach(f => {
                    const price = f.c || f.px_ask || f.px_bid || f.last || f.price;
                    console.log(`- ${f.symbol || f.ticker}: Price=${price} (Raw: ${JSON.stringify(f)})`);
                });
            } else {
                console.log("\nWARNING: None of the problematic tickers were found in this section.");
            }
        }
    } catch (e) {
        console.error("FATAL ERROR:", e.message);
    }
}

async function run() {
    console.log("Starting Diagnosis...");

    // TTD25 -> Bonos
    await checkUrl('BONDS', 'https://data912.com/live/arg_bonds');

    // AAPL, MSFT -> Cedears
    await checkUrl('CEDEARS', 'https://data912.com/live/arg_cedears');
}

run();
