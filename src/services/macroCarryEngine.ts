
import Decimal from 'decimal.js';
import { Result } from '../types/finance';

// ============================================================================
// TYPES
// ============================================================================

export interface CarryInstrument {
    ticker: string;
    type: 'LECAP' | 'BONCAP' | 'BOTE' | 'CER' | 'OTHER';
    marketPrice: number;
    yieldTna: number;         // TNA in ARS (e.g. 0.45 for 45%)
    durationDays: number;     // Days to maturity or relevant duration
}

export interface MacroCarryMetrics {
    ticker: string;
    instrumentType: string;
    nominalRate: number;      // TNA in ARS
    fxDevaluation: number;    // Annualized Devaluation Expectation (TNA equiv)
    netCarryUsd: number;      // Effective USD Yield (Nominal - Deval)
    carryScore: number;       // 0-100 Score
}

// ============================================================================
// MOCK DATA & CONFIG (Since we don't have real-time Rofex yet)
// ============================================================================

// Assumed Monthly Crawling Peg or Market Expectation (TEM)
const FX_MONTHLY_DEVAL_ESTIMATE = 0.025; // 2.5% Monthly
const FX_ANNUALIZED_DEVAL = FX_MONTHLY_DEVAL_ESTIMATE * 12; // Simple approx ~30%

// Mock Yields for ARS Instruments (since we lack a real bond scanner)
const ARS_YIELDS_MOCK: Record<string, number> = {
    // LECAPs (e.g. S31M5) - Usually trading near policy rate + premium
    'S31M5': 0.42,
    'S29N4': 0.40,
    'S30J5': 0.43,
    // BONCAPs / BOTEs
    'TX26': 0.55, // CER adjustment often higher nominal equiv
    'TX28': 0.58,
    'T2X5': 0.48,
    // Others
    'DOLAR': 0.00, // Reference
};

// ============================================================================
// MACRO CARRY ENGINE
// ============================================================================

export class MacroCarryEngine {

    /**
     * Calculate Carry Metrics for a list of potential instruments.
     * If a list is not provided, it returns metrics for a default watchlist of ARS assets.
     */
    async calculateMacroCarry(userPositions: any[] = []): Promise<Result<MacroCarryMetrics[]>> {
        try {
            const metrics: MacroCarryMetrics[] = [];
            const watchlist = this.getWatchlist(userPositions);

            for (const item of watchlist) {
                // 1. Get Nominal Rate (ARS)
                const nominalRate = item.yieldTna;

                // 2. Get Devaluation Cost
                // For accurate carry, we should match duration. 
                // Here we use a flat annualized expectation for simplicity.
                const devalCost = FX_ANNUALIZED_DEVAL;

                // 3. Calculate Net Carry (Linear Approx: Rate - Deval)
                // (1+r_ars) = (1+r_usd)*(1+deval) => r_usd ~= r_ars - deval
                const netCarry = nominalRate - devalCost;

                // 4. Score
                // 0% real carry = 50. +/- 10% range.
                let score = 50 + (netCarry * 100 * 2);
                score = Math.max(0, Math.min(100, score));

                metrics.push({
                    ticker: item.ticker,
                    instrumentType: item.type,
                    nominalRate: nominalRate,
                    fxDevaluation: devalCost,
                    netCarryUsd: netCarry,
                    carryScore: score
                });
            }

            // Sort by best carry
            metrics.sort((a, b) => b.netCarryUsd - a.netCarryUsd);

            return { success: true, data: metrics };

        } catch (error) {
            console.error('Error in MacroCarryEngine:', error);
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }

    /**
     * Helper to build a list of relevant ARS instruments.
     * Merges user's existing ARS positions with a standard watchlist.
     */
    private getWatchlist(userPositions: any[]): CarryInstrument[] {
        const watchlist: CarryInstrument[] = [];
        const seen = new Set<string>();

        // 1. Add Default Watchlist
        const defaults: CarryInstrument[] = [
            { ticker: 'S31M5', type: 'LECAP', marketPrice: 100, yieldTna: 0.42, durationDays: 90 },
            { ticker: 'S30J5', type: 'LECAP', marketPrice: 100, yieldTna: 0.43, durationDays: 120 },
            { ticker: 'T2X5', type: 'CER', marketPrice: 1500, yieldTna: 0.48, durationDays: 150 },
            { ticker: 'TX26', type: 'CER', marketPrice: 1200, yieldTna: 0.55, durationDays: 365 },
        ];

        defaults.forEach(i => {
            watchlist.push(i);
            seen.add(i.ticker);
        });

        // 2. Add relevant User Positions (if they are ARS bonds)
        // We filter user positions for those that look like ARS bonds
        userPositions.forEach(p => {
            if (p.assetClass === 'BONOS PESOS' || p.ticker.startsWith('S') || p.ticker.startsWith('T') || p.ticker.startsWith('X')) {
                if (!seen.has(p.ticker)) {
                    // Try to guess yield or use default fallback
                    const estimatedYield = ARS_YIELDS_MOCK[p.ticker] || 0.40;
                    watchlist.push({
                        ticker: p.ticker,
                        type: 'OTHER',
                        marketPrice: p.precioActual || 0,
                        yieldTna: estimatedYield,
                        durationDays: 180 // assumption
                    });
                    seen.add(p.ticker);
                }
            }
        });

        return watchlist;
    }
}

export const macroCarryEngine = new MacroCarryEngine();
