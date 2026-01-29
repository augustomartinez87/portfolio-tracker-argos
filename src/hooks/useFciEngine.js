import { useState, useEffect, useMemo, useCallback } from 'react';
import Decimal from 'decimal.js';
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
                    nombre: fci_master?.nombre || 'Desconocido',
                    cuotapartes: new Decimal(0),
                    montoInvertido: new Decimal(0), // Cash Flow neto (Suscripciones - Rescates)
                    montoInvertidoUSD: new Decimal(0)
                };
            }

            const montoDec = new Decimal(monto || 0);
            const cuotasDec = new Decimal(cuotapartes || 0);

            if (tipo === 'SUBSCRIPTION') {
                posMap[fci_id].cuotapartes = posMap[fci_id].cuotapartes.plus(cuotasDec);
                posMap[fci_id].montoInvertido = posMap[fci_id].montoInvertido.plus(montoDec);

                // Cálculo USD con precisión histórica usando el Map
                const dateStr = tx.fecha;
                const historicalMep = new Decimal(mepService.findClosestRate(dateStr, mepMap) || mepRate || 1);
                posMap[fci_id].montoInvertidoUSD = posMap[fci_id].montoInvertidoUSD.plus(montoDec.dividedBy(historicalMep));
            } else if (tipo === 'REDEMPTION') {
                const pos = posMap[fci_id];
                const avgCostARS = pos.cuotapartes.gt(0) ? pos.montoInvertido.dividedBy(pos.cuotapartes) : new Decimal(0);
                const avgCostUSD = pos.cuotapartes.gt(0) ? pos.montoInvertidoUSD.dividedBy(pos.cuotapartes) : new Decimal(0);

                pos.cuotapartes = pos.cuotapartes.minus(cuotasDec);
                pos.montoInvertido = pos.montoInvertido.minus(cuotasDec.times(avgCostARS));
                pos.montoInvertidoUSD = pos.montoInvertidoUSD.minus(cuotasDec.times(avgCostUSD));
            }
        });

        // Convertir a array y valuar
        return Object.values(posMap)
            .filter(p => p.cuotapartes.abs().gt(0.0001)) // Ocultar saldos cero
            .map(p => {
                const lastPrice = latestPrices[p.fciId];
                const vcpActual = new Decimal(lastPrice ? (lastPrice.vcp || 0) : 0);
                const fechaPrecios = lastPrice ? lastPrice.fecha : null;

                const valuacion = p.cuotapartes.times(vcpActual);
                const pnl = valuacion.minus(p.montoInvertido);
                const pnlPct = p.montoInvertido.isZero() ? new Decimal(0) : pnl.dividedBy(p.montoInvertido.abs()).times(100);

                const currentMepDec = new Decimal(mepRate || 1);
                const valuacionUSD = currentMepDec.gt(0) ? valuacion.dividedBy(currentMepDec) : new Decimal(0);
                const pnlUSD = valuacionUSD.minus(p.montoInvertidoUSD);

                return {
                    ...p,
                    cuotapartes: p.cuotapartes.toNumber(),
                    montoInvertido: p.montoInvertido.toNumber(),
                    montoInvertidoUSD: p.montoInvertidoUSD.toNumber(),
                    ultimoVcp: vcpActual.toNumber(),
                    fechaPrecios,
                    valuacion: valuacion.toNumber(),
                    pnl: pnl.toNumber(),
                    pnlPct: pnlPct.toNumber(),
                    valuacionUSD: valuacionUSD.toNumber(),
                    pnlUSD: pnlUSD.toNumber()
                };
            });
    }, [transactions, latestPrices, mepRate, mepHistory]);

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
        getVcpForDate: fciService.getPrices // Exponer servicio directo para búsquedas
    };
}
