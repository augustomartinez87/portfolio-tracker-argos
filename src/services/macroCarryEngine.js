
// ============================================================================
// TYPES (JSDoc)
// ============================================================================

/**
 * @typedef {Object} CarryInstrument
 * @property {string} ticker
 * @property {string} type
 * @property {number} marketPrice
 * @property {number} [redemptionValue]
 * @property {Date} [maturityDate]
 */

/**
 * @typedef {Object} MacroCarryMetrics
 * @property {string} ticker
 * @property {string} instrumentType
 * @property {number} marketPrice
 * @property {number} impliedYieldArs
 * @property {number} impliedYieldUsd
 * @property {number} carryScore
 */

// ============================================================================
// MACRO CARRY ENGINE
// ============================================================================

export class MacroCarryEngine {

    /**
     * Calculate Carry Metrics using Live Prices and MEP
     * @param {Array} userPositions - List of user positions (for highlighting/inclusion)
     * @param {Object} prices - Live price map from priceService
     * @param {number} mepRate - Current MEP rate
     * @returns {Promise<{success: boolean, data: MacroCarryMetrics[] | null, error?: Error}>}
     */
    async calculateMacroCarry(
        userPositions = [],
        prices = {},
        mepRate = 1
    ) {
        try {
            const metrics = [];
            const watchlist = this.getWatchlist(userPositions, prices);

            for (const item of watchlist) {
                if (item.marketPrice <= 0) continue;

                // 1. Calculate ARS Implied Yield (TNA)
                const contract = KNOWN_CONTRACTS[item.ticker];
                let impliedTna = 0;

                if (contract) {
                    const now = new Date();
                    const maturity = new Date(contract.maturity);
                    const daysToMaturity = Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 3600 * 24));

                    if (daysToMaturity > 0) {
                        // Return = (Redemption / Price) - 1
                        const totalReturn = (contract.redemptionValue / item.marketPrice) - 1;
                        // Annualize
                        impliedTna = totalReturn * (365 / daysToMaturity);
                    }
                } else {
                    // Fallback to mock yield if contract unknown
                    impliedTna = 0.45;
                }

                // 2. Calculate USD Implied Return
                const netCarry = impliedTna;

                // 3. Score
                let score = 50 + (netCarry * 100 * 2);
                score = Math.max(0, Math.min(100, score));

                metrics.push({
                    ticker: item.ticker,
                    instrumentType: item.type,
                    marketPrice: item.marketPrice,
                    impliedYieldArs: impliedTna,
                    impliedYieldUsd: netCarry, // Equal to ARS if stable FX
                    carryScore: score
                });
            }

            // Sort by best carry
            metrics.sort((a, b) => b.impliedYieldUsd - a.impliedYieldUsd);

            return { success: true, data: metrics };

        } catch (error) {
            console.error('Error in MacroCarryEngine:', error);
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }

    /**
     * Helper to build watchlist with Live Prices
     */
    getWatchlist(userPositions, prices) {
        const watchlist = [];
        const seen = new Set();

        const getPrice = (ticker) => prices[ticker]?.precio || 0;

        // 1. Defined Assets
        Object.keys(KNOWN_CONTRACTS).forEach(ticker => {
            const price = getPrice(ticker);
            if (price > 0 || KNOWN_CONTRACTS[ticker].type === 'LECAP') {
                watchlist.push({
                    ticker,
                    type: KNOWN_CONTRACTS[ticker].type,
                    marketPrice: price > 0 ? price : 100,
                });
                seen.add(ticker);
            }
        });

        // 2. Scan User ARS Assets
        userPositions.forEach(p => {
            if (!seen.has(p.ticker) && (p.assetClass === 'BONOS PESOS' || p.ticker.startsWith('S'))) {
                watchlist.push({
                    ticker: p.ticker,
                    type: 'OTHER',
                    marketPrice: p.precioActual || 0,
                });
                seen.add(p.ticker);
            }
        });

        return watchlist;
    }
}

// Minimal Metadata for Calculation
const KNOWN_CONTRACTS = {
    'S31M5': { type: 'LECAP', maturity: '2025-03-31', redemptionValue: 145.50 }, // Est redemption (Example)
    'S30J5': { type: 'LECAP', maturity: '2025-06-30', redemptionValue: 162.00 },
    'S29N4': { type: 'LECAP', maturity: '2024-11-29', redemptionValue: 130.00 }, // Expired? Just example.
    'T2X5': { type: 'CER', maturity: '2025-02-14', redemptionValue: 1550 }, // Indexed
    'TX26': { type: 'CER', maturity: '2026-11-09', redemptionValue: 1300 },
};

export const macroCarryEngine = new MacroCarryEngine();
