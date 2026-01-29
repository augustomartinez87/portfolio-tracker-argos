import { useMemo } from 'react';
import { getAssetClass, isBonoPesos, isBonoHardDollar, isON, calculateONValueInARS } from '@/utils/bondUtils';
import { mepService, MepHistoryItem } from '../services/mepService';
import { usePrices } from '@/features/portfolio/services/priceService';
import type { AssetClass, Position, PortfolioTotals, TradeInput } from '@/types';
import Decimal from 'decimal.js';

// Re-export types for backward compatibility with existing imports
export type { Position, PortfolioTotals };

// Alias TradeInput as Trade for backward compatibility
export type Trade = TradeInput;

/**
 * PriceData for engine use - flexible input type that accepts price data
 * from various sources (API, cache, etc.)
 * Note: This is a standalone type, not extending @/types/PriceData, to allow
 * more flexible typing for the engine's internal use.
 */
export interface PriceData {
    price?: number;
    pctChange?: number | null;
    assetClass?: AssetClass | string;
    panel?: string;
    isBonoPesos?: boolean;
    isBonoHD?: boolean;
    isStale?: boolean;
}

// Pure calculation functions
export const calculateTotals = (positions: Position[]): PortfolioTotals => {
    let invested = new Decimal(0);
    let valuationTotal = new Decimal(0);
    let dailyResultTotal = new Decimal(0);

    let investedUSD = new Decimal(0);
    let valuationUSDTotal = new Decimal(0);
    let dailyResultUSDTotal = new Decimal(0);

    for (const p of positions) {
        invested = invested.plus(p.totalCost);
        valuationTotal = valuationTotal.plus(p.valuation);
        dailyResultTotal = dailyResultTotal.plus(p.dailyResult || 0);

        investedUSD = investedUSD.plus(p.costUSD || 0);
        valuationUSDTotal = valuationUSDTotal.plus(p.valuationUSD || 0);
        dailyResultUSDTotal = dailyResultUSDTotal.plus(p.dailyResultUSD || 0);
    }

    const result = valuationTotal.minus(invested);
    const resultPct = invested.gt(0) ? result.dividedBy(invested).times(100) : new Decimal(0);
    const dailyResultPct = invested.gt(0) ? dailyResultTotal.dividedBy(invested).times(100) : new Decimal(0);

    const resultUSD = valuationUSDTotal.minus(investedUSD);
    const resultPctUSD = investedUSD.gt(0) ? resultUSD.dividedBy(investedUSD).times(100) : new Decimal(0);
    const dailyResultUSD = dailyResultUSDTotal;
    const dailyResultPctUSD = investedUSD.gt(0) ? dailyResultUSDTotal.dividedBy(investedUSD).times(100) : new Decimal(0);

    return {
        invested: invested.toNumber(),
        valuation: valuationTotal.toNumber(),
        result: result.toNumber(),
        resultPct: resultPct.toNumber(),
        dailyResult: dailyResultTotal.toNumber(),
        dailyResultPct: dailyResultPct.toNumber(),
        investedUSD: investedUSD.toNumber(),
        valuationUSD: valuationUSDTotal.toNumber(),
        resultUSD: resultUSD.toNumber(),
        resultPctUSD: resultPctUSD.toNumber(),
        dailyResultUSD: dailyResultUSD.toNumber(),
        dailyResultPctUSD: dailyResultPctUSD.toNumber()
    };
};

export const usePortfolioEngine = (
    trades: Trade[],
    prices: Record<string, PriceData>,
    mepRate: number,
    mepHistory: MepHistoryItem[] = []
) => {
    // 1. Prepare MEP Map for O(1) lookups
    const mepMap = useMemo(() => {
        // If external history is passed, prioritize it, otherwise let service handle it
        if (mepHistory.length > 0) {
            const map = new Map<string, number>();
            mepHistory.forEach(h => map.set(h.date, h.price));
            return map;
        }
        return mepService.getMepMap();
    }, [mepHistory]);

    const positions = useMemo(() => {
        const grouped: Record<string, any> = {};

        // Make a shallow copy to sort
        const sortedTrades = [...trades].sort((a, b) => {
            const dateA = new Date(a.trade_date || a.fecha || 0).getTime();
            const dateB = new Date(b.trade_date || b.fecha || 0).getTime();
            return dateA - dateB;
        });

        sortedTrades.forEach(trade => {
            const ticker = trade.ticker;
            if (!grouped[ticker]) {
                grouped[ticker] = {
                    ticker: ticker,
                    trades: [],
                    cantidadTotal: new Decimal(0),
                    costoTotal: new Decimal(0),
                    costoTotalUSD: new Decimal(0)
                };
            }
            grouped[ticker].trades.push(trade);

            const quantity = new Decimal(trade.quantity ?? trade.cantidad ?? 0);
            const price = new Decimal(trade.price ?? trade.precioCompra ?? 0);
            const tType = trade.trade_type ?? trade.tipo ?? '';

            const cantidadAbs = quantity.abs();
            const isSell = tType === 'sell' || tType === 'venta';

            if (isSell) {
                // Venta: reducir cantidad y costo proporcionalmente (WAC)
                const pos = grouped[ticker];

                // Avoid division by zero
                const precioPromedioActual = pos.cantidadTotal.gt(0)
                    ? pos.costoTotal.dividedBy(pos.cantidadTotal)
                    : new Decimal(0);

                const precioPromedioUSDActual = pos.cantidadTotal.gt(0)
                    ? pos.costoTotalUSD.dividedBy(pos.cantidadTotal)
                    : new Decimal(0);

                // No vender más de lo que hay
                const cantidadAVender = Decimal.min(cantidadAbs, pos.cantidadTotal);

                pos.cantidadTotal = pos.cantidadTotal.minus(cantidadAVender);
                pos.costoTotal = pos.costoTotal.minus(cantidadAVender.times(precioPromedioActual));
                pos.costoTotalUSD = pos.costoTotalUSD.minus(cantidadAVender.times(precioPromedioUSDActual));

                // Clean up small dust
                if (pos.cantidadTotal.lt(new Decimal(0.0001))) {
                    pos.cantidadTotal = new Decimal(0);
                    pos.costoTotal = new Decimal(0);
                    pos.costoTotalUSD = new Decimal(0);
                }
            } else {
                // Compra: sumar cantidad y costo
                const pos = grouped[ticker];
                pos.cantidadTotal = pos.cantidadTotal.plus(cantidadAbs);
                pos.costoTotal = pos.costoTotal.plus(cantidadAbs.times(price));

                // Cálculo USD con precisión histórica
                const dateStr = trade.trade_date || trade.fecha;
                const formattedDate = dateStr instanceof Date
                    ? dateStr.toISOString().split('T')[0]
                    : String(dateStr).split('T')[0];

                // Optimizado: O(1) lookup
                const historicalMepVal = mepService.findClosestRate(formattedDate, mepMap) || mepRate;
                const historicalMep = new Decimal(historicalMepVal > 0 ? historicalMepVal : 1);

                pos.costoTotalUSD = pos.costoTotalUSD.plus(
                    cantidadAbs.times(price).dividedBy(historicalMep)
                );
            }
        });

        // Filtrar posiciones y convertir a números finales
        return Object.values(grouped)
            .filter((pos: any) => pos.cantidadTotal.gt(0.0001))
            .map((pos: any): Position => {
                const priceData = prices[pos.ticker];
                const isPositionON = isON(pos.ticker);

                // Convert BigNums to numbers for display/interface compat
                const totalQuantityNum = pos.cantidadTotal.toNumber();
                const totalCostNum = pos.costoTotal.toNumber();
                const totalCostUSDNum = pos.costoTotalUSD.toNumber();

                // Calcular precio actual y valuación con conversión de ONs si es necesario
                let currentPrice = priceData?.price || 0;
                let valuation = totalQuantityNum * currentPrice;
                let usesONConversion = false;

                if (isPositionON && !pos.ticker.endsWith('O') && priceData && (priceData.price || 0) > 0) {
                    try {
                        const onValue = calculateONValueInARS(pos.ticker, totalQuantityNum, prices, mepRate);
                        currentPrice = onValue.priceInARS;
                        valuation = onValue.value;
                        usesONConversion = onValue.usesConversion;
                    } catch (error) {
                        console.warn('Error en conversión ON:', error instanceof Error ? error.message : 'Unknown error');
                        usesONConversion = false;
                    }
                }

                const avgPrice = totalQuantityNum > 0 ? totalCostNum / totalQuantityNum : 0;
                const result = valuation - totalCostNum;
                const resultPct = totalCostNum > 0 ? (result / totalCostNum) * 100 : 0;

                const dailyReturnPct = priceData?.pctChange || 0;
                const dailyResult = (dailyReturnPct / 100) * valuation;

                // P&L Attribution Logic (ARS View)
                // mepPromedio = CostoPesos / CostoDolares (implícito histórico)
                const mepPromedioPonderado = totalCostUSDNum > 0 ? totalCostNum / totalCostUSDNum : 0;

                // Si mepRate es 0 (error), asumimos sin efecto FX
                const currentMepSafe = mepRate > 0 ? mepRate : mepPromedioPonderado;

                // FX Result: Cuántos pesos más valen mis dólares originales solo por devaluación
                // (CostoUSD) * (MEP_Actual - MEP_Original)
                const resultadoFX = totalCostUSDNum * (currentMepSafe - mepPromedioPonderado);

                // Price Result: El resto de la ganancia es mérito del activo (o pérdida)
                // ResultadoTotal = FX + Precio  =>  Precio = Total - FX
                const resultadoPrecio = result - resultadoFX;

                // Asset Class Logic
                const assetClass = (priceData?.assetClass as AssetClass) || getAssetClass(pos.ticker, priceData?.panel);
                const isBP = priceData?.isBonoPesos ?? isBonoPesos(pos.ticker);
                const isBHD = priceData?.isBonoHD ?? isBonoHardDollar(pos.ticker);

                // USD Calculations
                const valuationUSD = mepRate > 0 ? valuation / mepRate : 0;
                const resultUSD = valuationUSD - totalCostUSDNum;
                // Avoid historical division by zero
                const resultPctUSD = totalCostUSDNum > 0 ? (resultUSD / totalCostUSDNum) * 100 : 0;
                const dailyResultUSD = mepRate > 0 ? dailyResult / mepRate : 0;

                return {
                    ticker: pos.ticker,
                    trades: pos.trades,
                    totalQuantity: totalQuantityNum,
                    totalCost: totalCostNum,
                    costUSD: totalCostUSDNum,
                    avgPrice,
                    currentPrice,
                    valuation,
                    result,
                    resultPct,
                    dailyResult,
                    dailyResultPct: dailyReturnPct,
                    assetClass,
                    pctChange: dailyReturnPct,
                    isBonoPesos: isBP,
                    isBonoHD: isBHD,
                    isON: isPositionON,
                    usesONConversion,
                    valuationUSD,
                    resultUSD,
                    resultPctUSD,
                    dailyResultUSD,
                    dailyResultPctUSD: dailyReturnPct,
                    // Attribution
                    mepPromedioPonderado,
                    resultadoFX,
                    resultadoPrecio
                };
            })
            .sort((a, b) => b.valuation - a.valuation);
    }, [trades, prices, mepRate, mepMap]);

    const totals = useMemo(() => calculateTotals(positions), [positions]);

    const isPricesReady = Object.keys(prices).length > 0;

    return {
        positions,
        totals,
        isPricesReady,
        calculateTotals
    };
};
