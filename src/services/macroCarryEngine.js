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
function calcularRetornoDirecto(precioActual, valorRescate) {
    return ((valorRescate / precioActual) - 1) * 100; // en porcentaje
}

function calcularMaxVarPosible(retornoTotal) {
    // Máxima devaluación tolerable = retorno total (en %)
    return Math.abs(retornoTotal);
}

function calcularSpreadVsTC(precioActual, valorRescate, diasAlVencimiento) {
    // Spread = TIR ARS Geométrica - Inflación proyectada
    // Fórmula geométrica consistente con el resto del motor
    if (diasAlVencimiento <= 0) return 0;
    const retornoAnualGeometrico = Math.pow(valorRescate / precioActual, 365 / diasAlVencimiento) - 1;
    return retornoAnualGeometrico - INFLACION_ANUAL;
}

function calcularBandaSuperior(valorRescate, precioActual, tcActual) {
    // Banda superior = tcActual * (valorRescate / precioActual) * 1.05
    const tcBase = tcActual * (valorRescate / precioActual);
    return tcBase * 1.05;
}

function calcularCarryParaTC(precioActual, valorRescate, diasAlVencimiento, tcProyectado) {
    // Calcular retorno en USD para un tipo de cambio proyectado
    if (diasAlVencimiento <= 0) return 0;
    
    const years = diasAlVencimiento / 365;
    const retornoTotalPesos = (valorRescate / precioActual); // Factor de retorno (1 + r)
    const devaluacionTotal = (tcProyectado / TC_ACTUAL); // Factor de devaluación
    
    // Fórmula Geométrica: ((1 + R_ars) / (1 + Deval))^(1/years) - 1
    const carryAnual = Math.pow(retornoTotalPesos / devaluacionTotal, 1/years) - 1;
    
    return carryAnual * 100; // convertir a porcentaje
}

function calcularTIRusd(precioActual, valorRescate, diasAlVencimiento) {
    if (diasAlVencimiento <= 0) return 0;
    
    const years = diasAlVencimiento / 365;
    const factorRetornoTotal = (valorRescate / precioActual);
    
    // TIR USD usando Fisher: (1 + R_anual_ars) / (1 + Inflacion_anual) - 1
    // Simplificado: (Factor_Retorno_Total)^(1/years) / (1 + INFLACION_ANUAL) - 1
    const tirUsd = (Math.pow(factorRetornoTotal, 1/years) / (1 + INFLACION_ANUAL)) - 1;
    
    return tirUsd; // TIR anual en USD (decimal)
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
                        // Cálculos principales (estilo Docta)
                        const retornoDirecto = calcularRetornoDirecto(marketPrice, metadata.redemptionValue);
                        // Retorno anualizado geométrico (consistente con fórmulas de carry)
                        const retornoTotalAnual = (Math.pow(metadata.redemptionValue / marketPrice, 365 / daysToMaturity) - 1) * 100;
                        const maxVarPosible = calcularMaxVarPosible(retornoDirecto);
                        const spreadVsTC = calcularSpreadVsTC(marketPrice, metadata.redemptionValue, daysToMaturity);
                        const bandaSuperior = calcularBandaSuperior(metadata.redemptionValue, marketPrice, tcActual);
                        const tirUsd = calcularTIRusd(marketPrice, metadata.redemptionValue, daysToMaturity);

                        // Cálculos de Carry para diferentes escenarios de TC
                        const carry1000 = calcularCarryParaTC(marketPrice, metadata.redemptionValue, daysToMaturity, 1000);
                        const carry1100 = calcularCarryParaTC(marketPrice, metadata.redemptionValue, daysToMaturity, 1100);
                        const carry1200 = calcularCarryParaTC(marketPrice, metadata.redemptionValue, daysToMaturity, 1200);
                        const carry1250 = calcularCarryParaTC(marketPrice, metadata.redemptionValue, daysToMaturity, 1250);
                        const carry1300 = calcularCarryParaTC(marketPrice, metadata.redemptionValue, daysToMaturity, 1300);
                        const carry1400 = calcularCarryParaTC(marketPrice, metadata.redemptionValue, daysToMaturity, 1400);

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
                            
                            // Métricas principales de Docta
                            retornoDirecto: retornoDirecto, // en %
                            maxVarPosible: maxVarPosible, // en %
                            spreadVsTC: spreadVsTC, // en puntos porcentuales
                            tirUsd: tirUsd, // en decimal
                            bandaSuperior: bandaSuperior, // en ARS
                            
                            // Cálculos de Carry para diferentes escenarios
                            carry1000: carry1000, // en %
                            carry1100: carry1100, // en %
                            carry1200: carry1200, // en %
                            carry1250: carry1250, // en %
                            carry1300: carry1300, // en %
                            carry1400: carry1400, // en %
                            
                            // Legacy compatibility
                            retornoTotal: retornoDirecto,
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
