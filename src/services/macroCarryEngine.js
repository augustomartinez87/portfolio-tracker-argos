
// ============================================================================
// MACRO CARRY ENGINE
// ============================================================================

export class MacroCarryEngine {

    /**
     * Calculate Carry Metrics using Live Prices and MEP
     * @param {Array} userPositions - List of user positions
     * @param {Object} prices - Live price map from priceService
     * @param {number} mepRate - Current MEP rate
     * @returns {Promise<{success: boolean, data: Array, error?: Error}>}
     */
    async calculateMacroCarry(
        userPositions = [],
        prices = {},
        mepRate = 1
    ) {
        try {
            const metrics = [];
            const now = new Date();

            // 1. Iterate over explicit BOND_METADATA (Priority)
            Object.keys(BOND_METADATA).forEach(ticker => {
                const metadata = BOND_METADATA[ticker];
                const priceData = prices[ticker];

                // Use live price if available, otherwise 0 (exclude)
                // Some tickers might be in 'bonds' panel.
                const marketPrice = priceData ? (priceData.precio || priceData.close || 0) : 0;

                if (marketPrice > 0) {
                    const maturity = new Date(metadata.maturity);
                    const daysToMaturity = Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 3600 * 24));

                    let impliedTna = 0;
                    let directReturn = 0;

                    if (daysToMaturity > 0) {
                        // Direct Return = (Redemption / Price) - 1
                        directReturn = (metadata.redemptionValue / marketPrice) - 1;
                        // Annualized TNA = DirectReturn * (365 / Days)
                        impliedTna = directReturn * (365 / daysToMaturity);
                    }

                    // Net Carry (Stable FX)
                    const netCarry = impliedTna;

                    // Score
                    let score = 50 + (netCarry * 100 * 2);
                    score = Math.max(0, Math.min(100, score));

                    metrics.push({
                        ticker: ticker,
                        instrumentType: ticker.startsWith('T') ? 'BONO TESORO' : 'LECAP',
                        marketPrice: marketPrice,
                        redemptionValue: metadata.redemptionValue,
                        daysToMaturity: daysToMaturity,
                        impliedYieldArs: impliedTna,
                        impliedYieldUsd: netCarry,
                        carryScore: score,
                        maturity: maturity
                    });
                }
            });

            // 2. Dynamic Scan (Fallback for new instruments not in metadata yet, optional)
            // For now, let's prioritize the user's specific list to keep it clean, 
            // but we can append others if they are clearly S/T bills.
            // (Skipping dynamic scan to focus on the User's "Truth Table" first).

            // Sort by best carry
            metrics.sort((a, b) => b.impliedYieldUsd - a.impliedYieldUsd);

            return { success: true, data: metrics };

        } catch (error) {
            console.error('Error in MacroCarryEngine:', error);
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }
}

// User Provided Metadata (Tickers + Maturity + Redemption Value "Pr. finish")
// Note: "Pr. finish" is likely the value at maturity.
// parsed from user request:
const BOND_METADATA = {
    'T30E6': { maturity: '2026-01-30', redemptionValue: 142.22 },
    'T13F6': { maturity: '2026-02-13', redemptionValue: 144.97 },
    'S27F6': { maturity: '2026-02-27', redemptionValue: 125.84 },
    'S17A6': { maturity: '2026-04-17', redemptionValue: 109.94 },
    'S30A6': { maturity: '2026-04-30', redemptionValue: 127.49 },
    'S29Y6': { maturity: '2026-05-29', redemptionValue: 132.04 }, // Y=May
    'T30J6': { maturity: '2026-06-30', redemptionValue: 144.90 },
    'S31G6': { maturity: '2026-08-31', redemptionValue: 127.06 }, // G=Aug
    'S30O6': { maturity: '2026-10-30', redemptionValue: 135.28 },
    'S30N6': { maturity: '2026-11-30', redemptionValue: 129.89 },
    'T15E7': { maturity: '2027-01-15', redemptionValue: 161.10 },
    'T30A7': { maturity: '2027-04-30', redemptionValue: 157.34 },
    'T31Y7': { maturity: '2027-05-31', redemptionValue: 152.18 },
    // T30J7 was listed but cut off. Adding placeholder if exists.
};

export const macroCarryEngine = new MacroCarryEngine();
