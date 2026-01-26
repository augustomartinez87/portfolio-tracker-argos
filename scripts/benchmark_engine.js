
import Decimal from 'decimal.js';

// --- MOCK DATA GENERATION ---
const generateMepHistory = (days = 2000) => {
    const history = [];
    let price = 1000;
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        price = price * (1 + (Math.random() - 0.48) * 0.01); // Random walk
        history.push({
            date: date.toISOString().split('T')[0],
            price: Number(price.toFixed(2))
        });
    }
    return history;
};

const generateTrades = (count = 10000, tickers = ['AAPL', 'GOOGL', 'TSLA', 'AL30']) => {
    const trades = [];
    for (let i = 0; i < count; i++) {
        trades.push({
            ticker: tickers[Math.floor(Math.random() * tickers.length)],
            quantity: Math.floor(Math.random() * 100) + 1,
            price: Math.floor(Math.random() * 5000) + 1000,
            trade_type: Math.random() > 0.3 ? 'buy' : 'sell',
            trade_date: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 365 * 3)).toISOString().split('T')[0]
        });
    }
    return trades;
};

// --- COPIED & ADAPTED ENGINE LOGIC (No React) ---
const simulateEngine = (trades, mepHistory) => {
    // 1. Prepare MEP Map (The Optimization)
    console.time('MepMap Init');
    const mepMap = new Map();
    mepHistory.forEach(h => mepMap.set(h.date, h.price));
    console.timeEnd('MepMap Init');

    // 2. Process Positions
    console.time('Trades Processing');
    const grouped = {};
    const mepRate = 1200; // Mock current

    // Sort
    const sortedTrades = [...trades].sort((a, b) => {
        return new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime();
    });

    sortedTrades.forEach(trade => {
        const ticker = trade.ticker;
        if (!grouped[ticker]) {
            grouped[ticker] = {
                ticker: ticker,
                cantidadTotal: new Decimal(0),
                costoTotal: new Decimal(0),
                costoTotalUSD: new Decimal(0)
            };
        }

        const quantity = new Decimal(trade.quantity);
        const price = new Decimal(trade.price);
        const isSell = trade.trade_type === 'sell';

        if (isSell) {
            const pos = grouped[ticker];
            if (pos.cantidadTotal.gt(0)) {
                const avgPrice = pos.costoTotal.dividedBy(pos.cantidadTotal);
                const avgPriceUSD = pos.costoTotalUSD.dividedBy(pos.cantidadTotal);
                const qtyToSell = Decimal.min(quantity, pos.cantidadTotal);

                pos.cantidadTotal = pos.cantidadTotal.minus(qtyToSell);
                pos.costoTotal = pos.costoTotal.minus(qtyToSell.times(avgPrice));
                pos.costoTotalUSD = pos.costoTotalUSD.minus(qtyToSell.times(avgPriceUSD));
            }
        } else {
            const pos = grouped[ticker];
            const dateStr = trade.trade_date;

            // O(1) Lookup logic
            let historicalMep = mepMap.get(dateStr);
            if (!historicalMep) {
                // Simple fallback for bench
                historicalMep = mepRate;
            }
            const mepVal = new Decimal(historicalMep);

            pos.cantidadTotal = pos.cantidadTotal.plus(quantity);
            pos.costoTotal = pos.costoTotal.plus(quantity.times(price));
            pos.costoTotalUSD = pos.costoTotalUSD.plus(quantity.times(price).dividedBy(mepVal));
        }
    });
    console.timeEnd('Trades Processing');

    return Object.keys(grouped).length;
};

// --- RUN ---
console.log('--- STARTING BENCHMARK ---');
const history = generateMepHistory();
const trades = generateTrades(10000); // 10k trades
console.log(`Generated ${history.length} MEP records and ${trades.length} trades.`);

const result = simulateEngine(trades, history);
console.log(`Processed ${result} active positions successfully.`);
console.log('--- DONE ---');
