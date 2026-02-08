import { useState, useEffect, useMemo, useCallback } from 'react';
import Decimal from 'decimal.js';
import { fciService } from '@/features/fci/services/fciService';
import { mepService } from '../../portfolio/services/mepService';


/**
 * Motor de cálculo FCI por lotes.
 * Reemplaza useFciEngine: cada suscripción es un lot independiente con su VCP de entrada.
 * PnL diario = cuotapartes * (VCP_t - VCP_{t-1}) por lote.
 * La posición agregada por fondo es solo display (VCP_PPC informativo).
 *
 * @param {string} portfolioId
 * @param {number} mepRate - MEP actual
 * @param {Array} mepHistory - Historial de MEP [{date, price}]
 */
export function useFciLotEngine(portfolioId, mepRate, mepHistory = []) {
    const [activeLots, setActiveLots] = useState([]);
    const [allLots, setAllLots] = useState([]);
    const [latestPrices, setLatestPrices] = useState({}); // { fciId: { fecha, vcp } }
    const [yesterdayPrices, setYesterdayPrices] = useState({}); // { fciId: { fecha, vcp } }
    const [lugaresList, setLugaresList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // =========================================================================
    // CARGA DE DATOS
    // =========================================================================

    const loadLots = useCallback(async () => {
        if (!portfolioId) {
            setActiveLots([]);
            setAllLots([]);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // Cargar lotes activos e inactivos en paralelo
            const [active, all] = await Promise.all([
                fciService.getActiveLots(portfolioId),
                fciService.getLots(portfolioId)
            ]);

            setActiveLots(active || []);
            setAllLots(all || []);

            // Identificar FCIs únicos para cargar precios
            const fciIds = [...new Set((active || []).map(l => l.fci_id))];

            // Cargar último precio de cada FCI (en paralelo)
            const latestMap = {};
            await Promise.all(fciIds.map(async (id) => {
                const latest = await fciService.getLatestPrice(id);
                if (latest) latestMap[id] = latest;
            }));
            setLatestPrices(latestMap);

            // Cargar precio anterior (VCP_{t-1}) para cada FCI
            // Necesitamos los últimos 2 precios: el último y el anterior
            const yesterdayMap = {};
            await Promise.all(fciIds.map(async (id) => {
                const latest = latestMap[id];
                if (!latest) return;

                // Buscar TODOS los precios históricos (sin filtro de fecha)
                // Esto permite calcular pnlDiario aunque el precio anterior sea antiguo
                // y hace el código más robusto ante gaps de data (fines de semana largos, feriados)
                const allPrices = await fciService.getPrices(id);
                if (!allPrices || allPrices.length < 2) return;

                // Encontrar el precio inmediatamente anterior al último
                // allPrices viene ordenado ASC por fecha
                const lastIdx = allPrices.findIndex(p => p.fecha === latest.fecha);
                if (lastIdx > 0) {
                    yesterdayMap[id] = allPrices[lastIdx - 1];
                }
            }));
            setYesterdayPrices(yesterdayMap);

        } catch (err) {
            console.error('[useFciLotEngine] Error loading data:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [portfolioId]);

    const loadLugares = useCallback(async () => {
        try {
            const data = await fciService.getLugares();
            setLugaresList(data || []);
        } catch (err) {
            console.error('[useFciLotEngine] Error loading lugares:', err);
        }
    }, []);

    // Carga inicial
    useEffect(() => {
        loadLots();
        loadLugares();
    }, [loadLots, loadLugares]);

    // =========================================================================
    // MEP MAP para lookups O(1)
    // =========================================================================
    const mepMap = useMemo(() => mepService.buildMepMap(mepHistory), [mepHistory]);

    // =========================================================================
    // COMPUTED: lotDetails — cada lot activo con sus campos calculados
    // =========================================================================
    const lotDetails = useMemo(() => {
        return activeLots.map(lot => {
            const latest = latestPrices[lot.fci_id];
            const yesterday = yesterdayPrices[lot.fci_id];

            const vcpT = new Decimal(latest ? (latest.vcp || 0) : 0);
            const vcpT1 = new Decimal(yesterday ? (yesterday.vcp || 0) : 0);
            const cp = new Decimal(lot.cuotapartes || 0);
            const capitalInvertido = new Decimal(lot.capital_invertido || 0);

            const valuation = cp.times(vcpT);
            const pnlAcumulado = valuation.minus(capitalInvertido);

            // PnL diario: variación entre el último precio y el anterior
            // Se calcula siempre que existan ambos precios (vcpT > 0 y vcpT1 > 0)
            // Esto permite mostrar el PnL del último día hábil en fines de semana/feriados
            const pnlDiario = (vcpT.gt(0) && vcpT1.gt(0))
                ? cp.times(vcpT.minus(vcpT1))
                : new Decimal(0);

            return {
                // Campos originales del lot
                id: lot.id,
                fci_id: lot.fci_id,
                lugar_id: lot.lugar_id,
                fecha_suscripcion: lot.fecha_suscripcion,
                vcp_entrada: Number(lot.vcp_entrada),
                cuotapartes: cp.toNumber(),
                capital_invertido: capitalInvertido.toNumber(),
                activo: lot.activo,
                notes: lot.notes,
                // Joins
                nombreFondo: lot.fci_master?.nombre || 'Desconocido',
                nombreLugar: lot.lugares?.nombre || null,
                // Computados
                valuation: valuation.toNumber(),
                pnlAcumulado: pnlAcumulado.toNumber(),
                pnlDiario: pnlDiario.toNumber()
            };
        });
    }, [activeLots, latestPrices, yesterdayPrices]);

    // =========================================================================
    // COMPUTED: positions — agregación por fondo con compatibilidad backward
    // =========================================================================
    const positions = useMemo(() => {
        // Agrupar lotDetails por fci_id
        const grouped = {};
        lotDetails.forEach(lot => {
            if (!grouped[lot.fci_id]) {
                grouped[lot.fci_id] = {
                    fciId: lot.fci_id,
                    name: lot.nombreFondo,
                    lots: [],
                    // Acumuladores en Decimal
                    _quantity: new Decimal(0),
                    _capitalInvertido: new Decimal(0),
                    _valuation: new Decimal(0),
                    _pnlDiario: new Decimal(0),
                    _vcpPpcNum: new Decimal(0),  // sum(vcp_entrada * cuotapartes)
                    _investedUSD: new Decimal(0)
                };
            }

            const g = grouped[lot.fci_id];
            g.lots.push(lot);

            const cp = new Decimal(lot.cuotapartes);
            g._quantity = g._quantity.plus(cp);
            g._capitalInvertido = g._capitalInvertido.plus(lot.capital_invertido);
            g._valuation = g._valuation.plus(lot.valuation);
            g._pnlDiario = g._pnlDiario.plus(lot.pnlDiario);
            g._vcpPpcNum = g._vcpPpcNum.plus(new Decimal(lot.vcp_entrada).times(cp));

            // investedUSD por lote: capital_invertido / MEP(fecha_suscripcion)
            const historicalMep = new Decimal(
                mepService.findClosestRate(lot.fecha_suscripcion, mepMap) || mepRate || 1
            );
            g._investedUSD = g._investedUSD.plus(
                new Decimal(lot.capital_invertido).dividedBy(historicalMep)
            );
        });

        // Convertir a array final
        return Object.values(grouped).map(g => {
            const latest = latestPrices[g.fciId];
            const vcpActual = new Decimal(latest ? (latest.vcp || 0) : 0);
            const currentMepDec = new Decimal(mepRate || 1);

            const pnlAcumulado = g._valuation.minus(g._capitalInvertido);
            const vcpPPC = g._quantity.gt(0)
                ? g._vcpPpcNum.dividedBy(g._quantity)
                : new Decimal(0);

            const valuationUSD = currentMepDec.gt(0)
                ? g._valuation.dividedBy(currentMepDec)
                : new Decimal(0);
            const pnlUSD = valuationUSD.minus(g._investedUSD);

            // PnL diario en USD
            const pnlDiarioUSD = currentMepDec.gt(0)
                ? g._pnlDiario.dividedBy(currentMepDec)
                : new Decimal(0);

            return {
                fciId: g.fciId,
                name: g.name,
                lots: g.lots,
                // Campos principales
                quantity: g._quantity.toNumber(),
                capitalInvertido: g._capitalInvertido.toNumber(),
                valuation: g._valuation.toNumber(),
                pnlAcumulado: pnlAcumulado.toNumber(),
                pnlDiario: g._pnlDiario.toNumber(),
                pnlDiarioUSD: pnlDiarioUSD.toNumber(),
                vcpActual: vcpActual.toNumber(),
                vcpPPC: vcpPPC.toNumber(),
                priceDate: latest ? latest.fecha : null,
                // Campos backward-compat (consumidos por usePortfolioEngine.ts y FundingEngine)
                invested: g._capitalInvertido.toNumber(),
                lastVcp: vcpActual.toNumber(),
                pnl: pnlAcumulado.toNumber(),
                pnlPct: g._capitalInvertido.isZero()
                    ? 0
                    : pnlAcumulado.dividedBy(g._capitalInvertido.abs()).times(100).toNumber(),
                investedUSD: g._investedUSD.toNumber(),
                valuationUSD: valuationUSD.toNumber(),
                pnlUSD: pnlUSD.toNumber(),
                pnlPctUSD: g._investedUSD.isZero()
                    ? 0
                    : pnlUSD.dividedBy(g._investedUSD.abs()).times(100).toNumber()
            };
        });
    }, [lotDetails, latestPrices, mepRate, mepMap]);

    // =========================================================================
    // COMPUTED: totals — shape idéntico al fciTotals actual
    // =========================================================================
    const totals = useMemo(() => {
        let invested = new Decimal(0);
        let valuation = new Decimal(0);
        let investedUSD = new Decimal(0);
        let valuationUSD = new Decimal(0);

        for (const pos of positions) {
            invested = invested.plus(pos.capitalInvertido || 0);
            valuation = valuation.plus(pos.valuation || 0);
            investedUSD = investedUSD.plus(pos.investedUSD || 0);
            valuationUSD = valuationUSD.plus(pos.valuationUSD || 0);
        }

        return {
            invested: invested.toNumber(),
            valuation: valuation.toNumber(),
            pnl: valuation.minus(invested).toNumber(),
            investedUSD: investedUSD.toNumber(),
            valuationUSD: valuationUSD.toNumber(),
            pnlUSD: valuationUSD.minus(investedUSD).toNumber()
        };
    }, [positions]);

    // =========================================================================
    // FUNCIONES DE MUTACIÓN
    // =========================================================================

    const addLot = useCallback(async (lotData) => {
        try {
            await fciService.createLot(lotData);
            await loadLots();
        } catch (err) {
            console.error('[useFciLotEngine] Error adding lot:', err);
            throw err;
        }
    }, [loadLots]);

    const deleteLot = useCallback(async (lotId) => {
        try {
            await fciService.deleteLot(lotId);
            await loadLots();
        } catch (err) {
            console.error('[useFciLotEngine] Error deleting lot:', err);
            throw err;
        }
    }, [loadLots]);

    const updateLot = useCallback(async (lotId, updates) => {
        try {
            await fciService.updateLot(lotId, updates);
            await loadLots();
        } catch (err) {
            console.error('[useFciLotEngine] Error updating lot:', err);
            throw err;
        }
    }, [loadLots]);

    const redeemFIFO = useCallback(async (fciId, cuotapartes) => {
        try {
            const result = await fciService.applyRedemptionFIFO(portfolioId, fciId, cuotapartes);
            await loadLots();
            return result;
        } catch (err) {
            console.error('[useFciLotEngine] Error applying redemption:', err);
            throw err;
        }
    }, [portfolioId, loadLots]);

    const addLugar = useCallback(async (userId, nombre) => {
        try {
            const lugar = await fciService.createLugar({ user_id: userId, nombre });
            setLugaresList(prev => [...prev, lugar].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            return lugar;
        } catch (err) {
            console.error('[useFciLotEngine] Error creating lugar:', err);
            throw err;
        }
    }, []);

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    return {
        // Datos
        positions,
        totals,
        allLots,
        lugaresList,
        loading,
        error,
        // Mutaciones
        addLot,
        deleteLot,
        updateLot,
        redeemFIFO,
        addLugar,
        // Refresh manual
        refresh: loadLots
    };
}
