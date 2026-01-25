import { useMemo } from 'react';

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
    costoUSD: number;
    valuacionUSD: number;
    resultadoUSD: number;
    resultadoDiarioUSD: number;
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
    resultadoDiarioUSD: number;
}

// Helpers from original code (adapted)
const isBonoPesos = (ticker: string) => {
    const t = ticker.toUpperCase();
    // Simple heuristic based on common ARS bonds logic found in codebase
    return t.endsWith('P') || ['TX24', 'TX26', 'TX28', 'DICP', 'PARP', 'CUAP', 'TO26'].includes(t);
};

const isBonoHardDollar = (ticker: string) => {
    const t = ticker.toUpperCase();
    return ['AL29', 'AL30', 'AL35', 'AE38', 'AL41', 'GD29', 'GD30', 'GD35', 'GD38', 'GD41', 'GD46'].includes(t);
};

const getAssetClass = (ticker: string, panel?: string) => {
    if (panel) return panel;
    if (isBonoPesos(ticker)) return 'BONOS PESOS';
    if (isBonoHardDollar(ticker)) return 'BONO HARD DOLLAR';
    if (ticker.includes('CEDEAR')) return 'CEDEAR'; // unlikely to be in ticker string directly usually
    // Fallback heuristics
    if (ticker.endsWith('D') || ticker.endsWith('C')) return 'BONO HARD DOLLAR';
    return 'ACCIONES'; // Default
};

// Pure calculation functions
export const calculateTotals = (positions: Position[], mepRate: number): PortfolioTotals => {
    const invertido = positions.reduce((sum, p) => sum + p.costoTotal, 0);
    const valuacion = positions.reduce((sum, p) => sum + p.valuacionActual, 0);
    const resultado = valuacion - invertido;
    const resultadoPct = invertido > 0 ? (resultado / invertido) * 100 : 0;
    const resultadoDiario = positions.reduce((sum, p) => sum + (p.resultadoDiario || 0), 0);
    const resultadoDiarioPct = invertido > 0 ? (resultadoDiario / invertido) * 100 : 0;

    return {
        invertido,
        valuacion,
        resultado,
        resultadoPct,
        resultadoDiario,
        resultadoDiarioPct,
        invertidoUSD: mepRate > 0 ? invertido / mepRate : 0,
        valuacionUSD: mepRate > 0 ? valuacion / mepRate : 0,
        resultadoUSD: mepRate > 0 ? resultado / mepRate : 0,
        resultadoDiarioUSD: mepRate > 0 ? resultadoDiario / mepRate : 0
    };
};

export const usePortfolioEngine = (
    trades: Trade[],
    prices: Record<string, PriceData>,
    mepRate: number
) => {
    const positions = useMemo(() => {
        const grouped: Record<string, any> = {};

        // Ordenar trades por fecha para procesar en orden cronológico
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
                    cantidadTotal: 0,
                    costoTotal: 0
                };
            }
            grouped[ticker].trades.push(trade);

            const quantity = trade.quantity ?? trade.cantidad ?? 0;
            const price = trade.price ?? trade.precioCompra ?? 0;
            const tType = trade.trade_type ?? trade.tipo ?? '';

            const cantidad = Math.abs(quantity);
            const isSell = tType === 'sell' || tType === 'venta';

            if (isSell) {
                // Venta: reducir cantidad y costo proporcionalmente (método promedio ponderado)
                const pos = grouped[ticker];
                const precioPromedioActual = pos.cantidadTotal > 0 ? pos.costoTotal / pos.cantidadTotal : 0;
                const cantidadAVender = Math.min(cantidad, pos.cantidadTotal); // No vender más de lo que hay

                pos.cantidadTotal -= cantidadAVender;
                pos.costoTotal -= cantidadAVender * precioPromedioActual;

                // Evitar valores negativos por errores de redondeo
                if (pos.cantidadTotal < 0.0001) {
                    pos.cantidadTotal = 0;
                    pos.costoTotal = 0;
                }
            } else {
                // Compra: sumar cantidad y costo
                grouped[ticker].cantidadTotal += cantidad;
                grouped[ticker].costoTotal += cantidad * price;
            }
        });

        // Filtrar posiciones con cantidad 0 (completamente vendidas) y calcular métricas
        return Object.values(grouped)
            .filter((pos: any) => pos.cantidadTotal > 0.0001) // Filter almost zero
            .map((pos: any): Position => {
                const priceData = prices[pos.ticker];
                const precioActual = priceData?.precio || 0;
                const precioPromedio = pos.cantidadTotal > 0 ? pos.costoTotal / pos.cantidadTotal : 0;
                const valuacionActual = pos.cantidadTotal * precioActual;
                const resultado = valuacionActual - pos.costoTotal;
                const resultadoPct = pos.costoTotal > 0 ? (resultado / pos.costoTotal) * 100 : 0;

                const dailyReturnPct = priceData?.pctChange || 0;
                const resultadoDiario = (dailyReturnPct / 100) * valuacionActual;
                const resultadoDiarioPct = dailyReturnPct;

                // Determine asset class properly from price data or fallback
                const assetClass = priceData?.assetClass || getAssetClass(pos.ticker, priceData?.panel);

                // Check bond types from price data or helpers
                const isBP = priceData?.isBonoPesos ?? isBonoPesos(pos.ticker);
                const isBHD = priceData?.isBonoHD ?? isBonoHardDollar(pos.ticker);

                return {
                    ...pos,
                    precioPromedio,
                    precioActual,
                    valuacionActual,
                    resultado,
                    resultadoPct,
                    resultadoDiario,
                    resultadoDiarioPct,
                    assetClass,
                    pctChange: priceData?.pctChange || 0,
                    isBonoPesos: isBP,
                    isBonoHD: isBHD,
                    costoUSD: mepRate > 0 ? pos.costoTotal / mepRate : 0,
                    valuacionUSD: mepRate > 0 ? valuacionActual / mepRate : 0,
                    resultadoUSD: mepRate > 0 ? resultado / mepRate : 0,
                    resultadoDiarioUSD: mepRate > 0 ? resultadoDiario / mepRate : 0
                };
            })
            .sort((a, b) => b.valuacionActual - a.valuacionActual);
    }, [trades, prices, mepRate]);

    const totals = useMemo(() => calculateTotals(positions, mepRate), [positions, mepRate]);

    return {
        positions,
        totals,
        calculateTotals
    };
};
