// ============================================================================
// MACRO CARRY ENGINE
// ============================================================================

// Constantes para cálculos de carry trade
const INFLACION_MENSUAL = 0.01; // 1% mensual
const INFLACION_ANUAL = Math.pow(1 + INFLACION_MENSUAL, 12) - 1; // ~12.68% anual
const TC_ACTUAL = 1455; // Tipo de cambio actual (puede venir de MEP rate)

// User Provided Metadata (Tickers + Maturity + Redemption Value "Pr. finish")
// Actualizado con datos reales de Docta (26/01/2026)
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
    'TTM26': { maturity: '2026-03-16', redemptionValue: 135.24 },
    'TTJ26': { maturity: '2026-06-30', redemptionValue: 144.63 },
    'TTS26': { maturity: '2026-09-15', redemptionValue: 152.10 },
    'TTD26': { maturity: '2026-12-15', redemptionValue: 161.14 },
    'T30J7': { maturity: '2027-06-30', redemptionValue: 156.04 },
};

// Helper functions para cálculos de carry trade
function calcularRetornoTotal(precioActual, valorRescate) {
    return ((valorRescate / precioActual) - 1) * 100; // en porcentaje
}

function calcularMaxVarPosible(retornoTotal) {
    // Máxima devaluación tolerable = retorno total (en %)
    return Math.abs(retornoTotal);
}

function calcularSpreadVsTC(retornoTotalAnual, diasAlVencimiento) {
    // Spread = TIR ARS - Devaluación proyectada (inflación anual ~12.68%)
    // Usamos el retorno anualizado - inflación proyectada
    return retornoTotalAnual - INFLACION_ANUAL;
}

function calcularBandasBreakeven(valorRescate, precioActual, diasAlVencimiento, tcActual) {
    // TC donde el retorno en USD es cero
    // TC_breakeven = tcActual * (valorRescate / precioActual)
    const tcBase = tcActual * (valorRescate / precioActual);
    
    // Bandas con variación de inflación (±0.5% mensual aprox)
    const variacionSup = 0.05; // 5% superior
    const variacionInf = 0.10; // 10% inferior
    
    return {
        superior: tcBase * (1 + variacionSup),
        base: tcBase,
        inferior: tcBase * (1 - variacionInf)
    };
}

function calcularTIRusd(precioActual, valorRescate, diasAlVencimiento) {
    if (diasAlVencimiento <= 0) return 0;
    
    const years = diasAlVencimiento / 365;
    const retornoTotal = (valorRescate / precioActual) - 1;
    
    // TIR USD asumiendo devaluación igual a inflación proyectada
    const retornoReal = retornoTotal - INFLACION_ANUAL * years;
    
    return retornoReal / years; // TIR anual en USD
}

export class MacroCarryEngine {

    /**
     * Calculate Carry Metrics usando lógica de Docta Capital
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
            const tcActual = mepRate || TC_ACTUAL;

            // 1. Iterate over explicit BOND_METADATA (Priority)
            Object.keys(BOND_METADATA).forEach(ticker => {
                const metadata = BOND_METADATA[ticker];
                const priceData = prices[ticker];

                // Use live price if available, otherwise 0 (exclude)
                const marketPrice = priceData ? (priceData.precio || priceData.close || 0) : 0;

                if (marketPrice > 0) {
                    const maturity = new Date(metadata.maturity);
                    const daysToMaturity = Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 3600 * 24));

                    if (daysToMaturity > 0) {
                        // Cálculos principales
                        const retornoTotal = calcularRetornoTotal(marketPrice, metadata.redemptionValue);
                        const retornoTotalAnual = retornoTotal * (365 / daysToMaturity);
                        const maxVarPosible = calcularMaxVarPosible(retornoTotal);
                        const spreadVsTC = calcularSpreadVsTC(retornoTotalAnual, daysToMaturity);
                        const bandasBreakeven = calcularBandasBreakeven(metadata.redemptionValue, marketPrice, daysToMaturity, tcActual);
                        const tirUsd = calcularTIRusd(marketPrice, metadata.redemptionValue, daysToMaturity);

                        // Net Carry (Stable FX) - legacy compatibility
                        const netCarry = retornoTotalAnual / 100; // convertir a decimal

                        // Score (0-100) basado en spread vs TC
                        let score = 50 + (spreadVsTC * 100);
                        score = Math.max(0, Math.min(100, score));

                        metrics.push({
                            // Datos básicos
                            ticker: ticker,
                            instrumentType: ticker.startsWith('T') ? 'BONO TESORO' : 'LECAP',
                            marketPrice: marketPrice,
                            redemptionValue: metadata.redemptionValue,
                            daysToMaturity: daysToMaturity,
                            maturity: maturity,
                            
                            // Métricas de Docta
                            retornoTotal: retornoTotal, // en %
                            maxVarPosible: maxVarPosible, // en %
                            spreadVsTC: spreadVsTC, // en puntos porcentuales
                            tirUsd: tirUsd, // en decimal
                            
                            // Bandas de breakeven
                            bandaSuperior: bandasBreakeven.superior,
                            bandaInferior: bandasBreakeven.inferior,
                            
                            // Legacy compatibility
                            impliedYieldArs: retornoTotalAnual / 100,
                            impliedYieldUsd: netCarry,
                            carryScore: score
                        });
                    }
                }
            });

            // Sort by mejor spread vs TC (como en Docta)
            metrics.sort((a, b) => b.spreadVsTC - a.spreadVsTC);

            return { success: true, data: metrics };

        } catch (error) {
            console.error('Error in MacroCarryEngine:', error);
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }
}

export const macroCarryEngine = new MacroCarryEngine();
