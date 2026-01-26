import { useState, useEffect, useMemo, useCallback } from 'react';
import { fciService } from '../services/fciService';
import { mepService } from '../services/mepService';

/**
 * Hook para manejar la lógica de negocio de FCIs
 * @param {string} portfolioId - ID del portfolio activo
 * @param {number} mepRate - Cotización MEP actual
 * @param {Array} mepHistory - Historial de MEP
 */
export function useFciEngine(portfolioId, mepRate, mepHistory = []) {
    const [transactions, setTransactions] = useState([]);
    const [pricesCache, setPricesCache] = useState({}); // { fciId: { fecha: vcp } }
    const [latestPrices, setLatestPrices] = useState({}); // { fciId: { fecha, vcp } }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 1. Cargar transacciones al montar o cambiar portfolio
    useEffect(() => {
        if (!portfolioId) {
            setTransactions([]);
            return;
        }

        const loadData = async () => {
            setLoading(true);
            try {
                const txs = await fciService.getTransactions(portfolioId);
                setTransactions(txs || []);

                // Identificar FCIs únicos para cargar sus últimos precios
                const fciIds = [...new Set(txs.map(t => t.fci_id))];

                // Cargar últimos precios (paralelo)
                const pricesMap = {};
                await Promise.all(fciIds.map(async (id) => {
                    const latest = await fciService.getLatestPrice(id);
                    if (latest) {
                        pricesMap[id] = latest;
                    }
                }));

                setLatestPrices(pricesMap);
            } catch (err) {
                console.error("Error loading FCI data:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [portfolioId]);

    // 2. Calcular Posiciones Consolidadas
    const positions = useMemo(() => {
        const posMap = {};

        transactions.forEach(tx => {
            const { fci_id, fci_master, tipo, monto, cuotapartes, vcp_operado } = tx;

            if (!posMap[fci_id]) {
                posMap[fci_id] = {
                    fciId: fci_id,
                    nombre: fci_master?.nombre || 'Desconocido',
                    cuotapartes: 0,
                    montoInvertido: 0, // Cash Flow neto (Suscripciones - Rescates)
                    montoInvertidoUSD: 0
                };
            }

            const montoNum = Number(monto);
            const cuotasNum = Number(cuotapartes);

            if (tipo === 'SUBSCRIPTION') {
                posMap[fci_id].cuotapartes += cuotasNum;
                posMap[fci_id].montoInvertido += montoNum;

                // Cálculo USD con precisión histórica
                const dateStr = tx.fecha;
                const historicalMep = mepService.findClosestRate(dateStr, mepHistory) || mepRate;
                posMap[fci_id].montoInvertidoUSD += montoNum / historicalMep;
            } else if (tipo === 'REDEMPTION') {
                const pos = posMap[fci_id];
                const avgCostARS = pos.cuotapartes > 0 ? pos.montoInvertido / pos.cuotapartes : 0;
                const avgCostUSD = pos.cuotapartes > 0 ? pos.montoInvertidoUSD / pos.cuotapartes : 0;

                pos.cuotapartes -= cuotasNum;
                pos.montoInvertido -= cuotasNum * avgCostARS;
                pos.montoInvertidoUSD -= cuotasNum * avgCostUSD;
            }
        });

        // Convertir a array y valuar
        return Object.values(posMap)
            .filter(p => Math.abs(p.cuotapartes) > 0.0001) // Ocultar saldos cero
            .map(p => {
                const lastPrice = latestPrices[p.fciId];
                const vcpActual = lastPrice ? Number(lastPrice.vcp) : 0;
                const fechaPrecios = lastPrice ? lastPrice.fecha : null;

                const valuacion = p.cuotapartes * vcpActual;
                const pnl = valuacion - p.montoInvertido;
                const pnlPct = p.montoInvertido !== 0 ? (pnl / p.montoInvertido) * 100 : 0;

                const valuacionUSD = mepRate > 0 ? valuacion / mepRate : 0;
                const pnlUSD = valuacionUSD - p.montoInvertidoUSD;

                return {
                    ...p,
                    ultimoVcp: vcpActual,
                    fechaPrecios,
                    valuacion,
                    pnl,
                    pnlPct,
                    valuacionUSD,
                    pnlUSD
                };
            });
    }, [transactions, latestPrices]);

    // 3. Totales Generales
    const totals = useMemo(() => {
        return positions.reduce((acc, curr) => ({
            invested: acc.invested + curr.montoInvertido,
            valuation: acc.valuation + curr.valuacion,
            pnl: acc.pnl + curr.pnl,
            investedUSD: acc.investedUSD + curr.montoInvertidoUSD,
            valuationUSD: acc.valuationUSD + curr.valuacionUSD,
            pnlUSD: acc.pnlUSD + curr.pnlUSD
        }), { invested: 0, valuation: 0, pnl: 0, investedUSD: 0, valuationUSD: 0, pnlUSD: 0 });
    }, [positions]);

    // 4. Funciones para modificar datos (wrappers del servicio)
    const addTransaction = async (txData) => {
        try {
            // Necesitamos el VCP para la fecha
            // Nota: Idealmente la UI ya buscó el VCP, pero por seguridad lo validamos aquí o en backend
            const newTx = await fciService.createTransaction(txData);

            // Recargar transacciones (optimistic update podría ser mejor, pero esto es más seguro)
            const updatedTxs = await fciService.getTransactions(portfolioId);
            setTransactions(updatedTxs);

            return newTx;
        } catch (err) {
            throw err;
        }
    };

    const getVcpForDate = async (fciId, date) => {
        // Si ya lo tenemos en cache (TODO: implementar cache real), retornar
        // Si no, buscar
        const prices = await fciService.getPrices(fciId, date);
        // Buscar la fecha exacta
        const exactMatch = prices.find(p => p.fecha === date);
        if (exactMatch) return exactMatch.vcp;

        // Si no, buscar el más cercano anterior (fallback simple)
        // Asumimos que prices viene ordenado asc
        // Esto es simplificado
        return null;
    };

    return {
        positions,
        totals,
        transactions,
        loading,
        error,
        addTransaction,
        refresh: () => { }, // TODO
        getVcpForDate: fciService.getPrices // Exponer servicio directo para búsquedas
    };
}
