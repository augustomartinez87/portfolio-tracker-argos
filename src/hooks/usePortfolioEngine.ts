import { useMemo } from 'react';
import { getAssetClass, isBonoPesos, isBonoHardDollar, isON, calculateONValueInARS } from '../utils/bondUtils';
import { mepService, MepHistoryItem } from '../services/mepService';
import { AssetClass } from '../types';
import Decimal from 'decimal.js';

// Configuration for Decimal.js
// Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP }); 
// Note: Default precision is 20, sufficient for this use case. Removed to avoid type error with IDecimalStatic.

// Interfaces
export interface Trade {
    ticker: string;
    quantity?: number;
    cantidad?: number;
    price?: number;
    precioCompra?: number;
    trade_type?: string;
    tipo?: string;
    trade_date?: string | Date;
    fecha?: string | Date;
    [key: string]: any;
}

export interface PriceData {
    precio?: number;
    pctChange?: number;
    assetClass?: string;
    panel?: string;
    isBonoPesos?: boolean;
    isBonoHD?: boolean;
    isStale?: boolean;
}

export interface Position {
    ticker: string;
    cantidadTotal: number;
    costoTotal: number;
    precioPromedio: number;
    precioActual: number;
    valuacionActual: number;
    resultado: number;
    resultadoPct: number;
    resultadoDiario: number;
    resultadoDiarioPct: number;
    assetClass: string;
    pctChange: number;
    isBonoPesos: boolean;
    isBonoHD: boolean;
    isON?: boolean;
    usesONConversion?: boolean;
    costoUSD: number;
    valuacionUSD: number;
    resultadoUSD: number;
    resultadoDiarioUSD: number;
    resultadoPctUSD: number;
    resultadoDiarioPctUSD: number;
    // P&L Attribution
    mepPromedioPonderado: number;
    resultadoFX: number; // Ganancia por suba del MEP
    resultadoPrecio: number; // Ganancia por suba del activo
    trades: Trade[];
}

export interface PortfolioTotals {
    invertido: number;
    valuacion: number;
    resultado: number;
    resultadoPct: number;
    resultadoDiario: number;
    resultadoDiarioPct: number;
    invertidoUSD: number;
    valuacionUSD: number;
    resultadoUSD: number;
    resultadoPctUSD: number;
    resultadoDiarioUSD: number;
    resultadoDiarioPctUSD: number;
}

// Pure calculation functions
export const calculateTotals = (positions: Position[]): PortfolioTotals => {
    // Initialize Decimals
    let invertido = new Decimal(0);
    let valuacion = new Decimal(0);
    let resultadoDiario = new Decimal(0);
    let invertidoUSD = new Decimal(0);
    let valuacionUSD = new Decimal(0);
    let resultadoDiarioUSD = new Decimal(0);

    for (const p of positions) {
        invertido = invertido.plus(p.costoTotal);
        valuacion = valuacion.plus(p.valuacionActual);
        resultadoDiario = resultadoDiario.plus(p.resultadoDiario || 0);

        invertidoUSD = invertidoUSD.plus(p.costoUSD || 0);
        valuacionUSD = valuacionUSD.plus(p.valuacionUSD || 0);
        resultadoDiarioUSD = resultadoDiarioUSD.plus(p.resultadoDiarioUSD || 0);
    }

    const resultado = valuacion.minus(invertido);
    const resultadoPct = invertido.gt(0) ? resultado.dividedBy(invertido).times(100) : new Decimal(0);
    const resultadoDiarioPct = invertido.gt(0) ? resultadoDiario.dividedBy(invertido).times(100) : new Decimal(0);

    const resultadoUSD = valuacionUSD.minus(invertidoUSD);
    const resultadoPctUSD = invertidoUSD.gt(0) ? resultadoUSD.dividedBy(invertidoUSD).times(100) : new Decimal(0);
    const resultadoDiarioPctUSD = invertidoUSD.gt(0) ? resultadoDiarioUSD.dividedBy(invertidoUSD).times(100) : new Decimal(0);

    return {
        invertido: invertido.toNumber(),
        valuacion: valuacion.toNumber(),
        resultado: resultado.toNumber(),
        resultadoPct: resultadoPct.toNumber(),
        resultadoDiario: resultadoDiario.toNumber(),
        resultadoDiarioPct: resultadoDiarioPct.toNumber(),
        invertidoUSD: invertidoUSD.toNumber(),
        valuacionUSD: valuacionUSD.toNumber(),
        resultadoUSD: resultadoUSD.toNumber(),
        resultadoPctUSD: resultadoPctUSD.toNumber(),
        resultadoDiarioUSD: resultadoDiarioUSD.toNumber(),
        resultadoDiarioPctUSD: resultadoDiarioPctUSD.toNumber()
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
                const cantidadTotalNum = pos.cantidadTotal.toNumber();
                const costoTotalNum = pos.costoTotal.toNumber();
                const costoTotalUSDNum = pos.costoTotalUSD.toNumber();

                // Calcular precio actual y valuación con conversión de ONs si es necesario
                let precioActual = priceData?.precio || 0;
                let valuacionActual = cantidadTotalNum * precioActual;
                let usesONConversion = false;

                if (isPositionON && !pos.ticker.endsWith('O') && priceData && (priceData.precio || 0) > 0) {
                    try {
                        const onValue = calculateONValueInARS(pos.ticker, cantidadTotalNum, prices, mepRate);
                        precioActual = onValue.priceInARS;
                        valuacionActual = onValue.value;
                        usesONConversion = onValue.usesConversion;
                    } catch (error) {
                        console.warn('Error en conversión ON:', error instanceof Error ? error.message : 'Unknown error');
                        usesONConversion = false;
                    }
                }

                const precioPromedio = cantidadTotalNum > 0 ? costoTotalNum / cantidadTotalNum : 0;
                const resultado = valuacionActual - costoTotalNum;
                const resultadoPct = costoTotalNum > 0 ? (resultado / costoTotalNum) * 100 : 0;

                const dailyReturnPct = priceData?.pctChange || 0;
                const resultadoDiario = (dailyReturnPct / 100) * valuacionActual;

                // P&L Attribution Logic (ARS View)
                // mepPromedio = CostoPesos / CostoDolares (implícito histórico)
                const mepPromedioPonderado = costoTotalUSDNum > 0 ? costoTotalNum / costoTotalUSDNum : 0;

                // Si mepRate es 0 (error), asumimos sin efecto FX
                const currentMepSafe = mepRate > 0 ? mepRate : mepPromedioPonderado;

                // FX Result: Cuántos pesos más valen mis dólares originales solo por devaluación
                // (CostoUSD) * (MEP_Actual - MEP_Original)
                const resultadoFX = costoTotalUSDNum * (currentMepSafe - mepPromedioPonderado);

                // Price Result: El resto de la ganancia es mérito del activo (o pérdida)
                // ResultadoTotal = FX + Precio  =>  Precio = Total - FX
                const resultadoPrecio = resultado - resultadoFX;

                const resultadoDiarioPct = dailyReturnPct;

                // Asset Class Logic
                const assetClass = (priceData?.assetClass as AssetClass) || getAssetClass(pos.ticker, priceData?.panel);
                const isBP = priceData?.isBonoPesos ?? isBonoPesos(pos.ticker);
                const isBHD = priceData?.isBonoHD ?? isBonoHardDollar(pos.ticker);

                // USD Calculations
                const valuacionUSD = mepRate > 0 ? valuacionActual / mepRate : 0;
                const resultadoUSD = valuacionUSD - costoTotalUSDNum;
                // Avoid historical division by zero
                const resultadoPctUSD = costoTotalUSDNum > 0 ? (resultadoUSD / costoTotalUSDNum) * 100 : 0;
                const resultadoDiarioUSD = mepRate > 0 ? resultadoDiario / mepRate : 0;

                return {
                    ticker: pos.ticker,
                    trades: pos.trades,
                    cantidadTotal: cantidadTotalNum,
                    costoTotal: costoTotalNum,
                    costoUSD: costoTotalUSDNum,
                    precioPromedio,
                    precioActual,
                    valuacionActual,
                    resultado,
                    resultadoPct,
                    resultadoDiario,
                    resultadoDiarioPct,
                    assetClass,
                    pctChange: dailyReturnPct,
                    isBonoPesos: isBP,
                    isBonoHD: isBHD,
                    isON: isPositionON,
                    usesONConversion,
                    valuacionUSD,
                    resultadoUSD,
                    resultadoPctUSD,
                    resultadoDiarioUSD,
                    resultadoDiarioPctUSD: dailyReturnPct,
                    // Attribution
                    mepPromedioPonderado,
                    resultadoFX,
                    resultadoPrecio
                };
            })
            .sort((a, b) => b.valuacionActual - a.valuacionActual);
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
