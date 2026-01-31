import { useState, useEffect, useMemo, useCallback } from 'react';
import Decimal from 'decimal.js';
import { fciService } from '@/features/fci/services/fciService';
import { mepService } from '../../portfolio/services/mepService';

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

        // Crear un Map para lookups O(1) si mepHistory es un array
        const mepMap = new Map();
        if (Array.isArray(mepHistory)) {
            mepHistory.forEach(h => mepMap.set(h.date, h.price));
        }

        transactions.forEach(tx => {
            const { fci_id, fci_master, tipo, monto, cuotapartes } = tx;

            if (!posMap[fci_id]) {
                posMap[fci_id] = {
                    fciId: fci_id,
                    name: fci_master?.nombre || 'Desconocido',
                    quantity: new Decimal(0),
                    invested: new Decimal(0), // Cash Flow neto (Suscripciones - Rescates)
                    investedUSD: new Decimal(0)
                };
            }

            const montoDec = new Decimal(monto || 0);
            const cuotasDec = new Decimal(cuotapartes || 0);

            if (tipo === 'SUBSCRIPTION') {
                posMap[fci_id].quantity = posMap[fci_id].quantity.plus(cuotasDec);
                posMap[fci_id].invested = posMap[fci_id].invested.plus(montoDec);

                // Cálculo USD con precisión histórica usando el Map
                const dateStr = tx.fecha;
                const historicalMep = new Decimal(mepService.findClosestRate(dateStr, mepMap) || mepRate || 1);
                posMap[fci_id].investedUSD = posMap[fci_id].investedUSD.plus(montoDec.dividedBy(historicalMep));
            } else if (tipo === 'REDEMPTION') {
                const pos = posMap[fci_id];
                const avgCostARS = pos.quantity.gt(0) ? pos.invested.dividedBy(pos.quantity) : new Decimal(0);
                const avgCostUSD = pos.quantity.gt(0) ? pos.investedUSD.dividedBy(pos.quantity) : new Decimal(0);

                pos.quantity = pos.quantity.minus(cuotasDec);
                pos.invested = pos.invested.minus(cuotasDec.times(avgCostARS));
                pos.investedUSD = pos.investedUSD.minus(cuotasDec.times(avgCostUSD));

                // Clean up small dust after redemption (matches usePortfolioEngine.ts pattern)
                if (pos.quantity.abs().lt(new Decimal(0.0001))) {
                    pos.quantity = new Decimal(0);
                    pos.invested = new Decimal(0);
                    pos.investedUSD = new Decimal(0);
                }
            }
        });

        // Convertir a array y valuar
        return Object.values(posMap)
            .filter(p => p.quantity.abs().gt(0.0001)) // Ocultar saldos cero
            .map(p => {
                const lastPrice = latestPrices[p.fciId];
                const vcpActual = new Decimal(lastPrice ? (lastPrice.vcp || 0) : 0);
                const fechaPrecios = lastPrice ? lastPrice.fecha : null;

                const valuation = p.quantity.times(vcpActual);
                const pnl = valuation.minus(p.invested);
                const pnlPct = p.invested.isZero() ? new Decimal(0) : pnl.dividedBy(p.invested.abs()).times(100);

                const currentMepDec = new Decimal(mepRate || 1);
                const valuationUSD = currentMepDec.gt(0) ? valuation.dividedBy(currentMepDec) : new Decimal(0);
                const pnlUSD = valuationUSD.minus(p.investedUSD);
                const pnlPctUSD = p.investedUSD.isZero() ? new Decimal(0) : pnlUSD.dividedBy(p.investedUSD.abs()).times(100);

                return {
                    ...p,
                    quantity: p.quantity.toNumber(),
                    invested: p.invested.toNumber(),
                    investedUSD: p.investedUSD.toNumber(),
                    lastVcp: vcpActual.toNumber(),
                    priceDate: fechaPrecios,
                    valuation: valuation.toNumber(),
                    pnl: pnl.toNumber(),
                    pnlPct: pnlPct.toNumber(),
                    valuationUSD: valuationUSD.toNumber(),
                    pnlUSD: pnlUSD.toNumber(),
                    pnlPctUSD: pnlPctUSD.toNumber()
                };
            });
    }, [transactions, latestPrices, mepRate, mepHistory]);

    // 3. Totales Generales (usando Decimal.js para precisión)
    const totals = useMemo(() => {
        // Initialize accumulators as Decimal
        let invested = new Decimal(0);
        let valuation = new Decimal(0);
        let pnl = new Decimal(0);
        let investedUSD = new Decimal(0);
        let valuationUSD = new Decimal(0);
        let pnlUSD = new Decimal(0);

        // Accumulate using Decimal arithmetic
        for (const pos of positions) {
            invested = invested.plus(pos.invested || 0);
            valuation = valuation.plus(pos.valuation || 0);
            pnl = pnl.plus(pos.pnl || 0);
            investedUSD = investedUSD.plus(pos.investedUSD || 0);
            valuationUSD = valuationUSD.plus(pos.valuationUSD || 0);
            pnlUSD = pnlUSD.plus(pos.pnlUSD || 0);
        }

        // Convert to Number only at the final output layer
        return {
            invested: invested.toNumber(),
            valuation: valuation.toNumber(),
            pnl: pnl.toNumber(),
            investedUSD: investedUSD.toNumber(),
            valuationUSD: valuationUSD.toNumber(),
            pnlUSD: pnlUSD.toNumber()
        };
    }, [positions]);

    // 4. Funciones para modificar datos (wrappers del servicio)
    const addTransaction = async (txData) => {
        try {
            const newTx = await fciService.createTransaction(txData);
            const updatedTxs = await fciService.getTransactions(portfolioId);
            setTransactions(updatedTxs);
            return newTx;
        } catch (err) {
            throw err;
        }
    };

    const deleteTransaction = async (id) => {
        try {
            await fciService.deleteTransaction(id);
            const updatedTxs = await fciService.getTransactions(portfolioId);
            setTransactions(updatedTxs);
        } catch (err) {
            console.error("Error deleting transaction:", err);
            throw err;
        }
    };

    const updateTransaction = async (id, updates) => {
        try {
            const updated = await fciService.updateTransaction(id, updates);
            const updatedTxs = await fciService.getTransactions(portfolioId);
            setTransactions(updatedTxs);
            return updated;
        } catch (err) {
            console.error("Error updating transaction:", err);
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
        deleteTransaction,
        updateTransaction,
        refresh: async () => {
            setLoading(true);
            try {
                const txs = await fciService.getTransactions(portfolioId);
                setTransactions(txs || []);

                const fciIds = [...new Set((txs || []).map(t => t.fci_id))];
                const pricesMap = {};
                await Promise.all(fciIds.map(async (id) => {
                    const latest = await fciService.getLatestPrice(id);
                    if (latest) pricesMap[id] = latest;
                }));
                setLatestPrices(pricesMap);
            } finally {
                setLoading(false);
            }
        },
        getVcpForDate // Exponer función local para búsquedas
    };
}
