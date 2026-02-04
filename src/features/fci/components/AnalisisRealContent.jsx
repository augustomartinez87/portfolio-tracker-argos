import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    TrendingUp, Calendar, BarChart3, RefreshCw, Wallet, Briefcase, AlertCircle
} from 'lucide-react';
import { formatARS, formatPercent, formatNumber } from '@/utils/formatters';
import { mepService } from '@/features/portfolio/services/mepService';
import { fciService } from '@/features/fci/services/fciService';
import { data912 } from '@/utils/data912';

const COLORS = {
    fci: '#3b82f6',    // Blue
    mep: '#ef4444',    // Red
    spy: '#10b981',    // Green
    fciArs: '#10b981', // Green
    fciUsd: '#6366f1', // Indigo
};

const AnalisisRealContent = () => {
    // Estados principales
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState('');
    const [useTodayAsEnd, setUseTodayAsEnd] = useState(true);
    const [initialAmount, setInitialAmount] = useState(1000000);
    const [fciCurrencyMode, setFciCurrencyMode] = useState('ARS');
    const [vcpHistory, setVcpHistory] = useState([]);
    const [spyHistory, setSpyHistory] = useState([]);
    const [mepHistory, setMepHistory] = useState([]);
    const [fcis, setFcis] = useState([]);
    const [selectedFci, setSelectedFci] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Función auxiliar para encontrar precio más cercano
    // Optimizada: busca hacia atrás máximo 10 días en O(k) en lugar de ordenar O(n log n)
    const findClosestPrice = (targetDate, priceMap) => {
        // O(1) - coincidencia exacta
        if (priceMap.has(targetDate)) return priceMap.get(targetDate);

        // Buscar fecha anterior más cercana (máximo 10 días atrás)
        const dateObj = new Date(targetDate);
        for (let i = 1; i <= 10; i++) {
            dateObj.setDate(dateObj.getDate() - 1);
            const prevDate = dateObj.toISOString().split('T')[0];
            if (priceMap.has(prevDate)) {
                return priceMap.get(prevDate);
            }
        }

        return null;
    };

    // Cargar fecha de hoy por defecto
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        if (useTodayAsEnd) {
            setEndDate(today);
        }
    }, [useTodayAsEnd]);

    // Cargar lista de FCI
    useEffect(() => {
        let cancelled = false;

        const loadFcis = async () => {
            try {
                const data = await fciService.getFcis();
                if (cancelled) return;

                setFcis(data || []);

                if (data && data.length === 1) {
                    setSelectedFci(data[0]);
                }
            } catch (err) {
                if (cancelled) return;
                console.error("Error loading FCIs:", err);
                setError("No se pudieron cargar los fondos disponibles");
            }
        };
        loadFcis();

        return () => { cancelled = true; };
    }, []);

    // Cargar datos históricos (SPY y MEP)
    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            setLoading(true);
            setError(null); // Limpiar error previo
            try {
                const [mep, spyData] = await Promise.all([
                    mepService.getHistory(),
                    fetchSpyHistory()
                ]);
                if (cancelled) return;

                setMepHistory(mep);
                setSpyHistory(spyData);
            } catch (err) {
                if (cancelled) return;
                console.error("Error loading data:", err);
                setError("Error al cargar datos históricos de MEP o SPY");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadData();

        return () => { cancelled = true; };
    }, [startDate]);

    // Cargar precios del FCI seleccionado
    useEffect(() => {
        if (!selectedFci) return;

        let cancelled = false;

        const loadFciPrices = async () => {
            try {
                const prices = await fciService.getPrices(selectedFci.id);
                if (cancelled) return;

                if (prices && prices.length > 0) {
                    const parsedVCP = prices.map(p => ({
                        date: p.fecha,
                        vcp: p.vcp
                    })).sort((a, b) => a.date.localeCompare(b.date));
                    setVcpHistory(parsedVCP);
                    setError(null); // Limpiar error si cargó bien
                } else {
                    setError(`No hay datos de precios para ${selectedFci.nombre}`);
                }
            } catch (err) {
                if (cancelled) return;
                console.error("Error loading FCI prices:", err);
                setError(`Error al cargar precios del FCI: ${selectedFci.nombre}`);
            }
        };
        loadFciPrices();

        return () => { cancelled = true; };
    }, [selectedFci]);

    // Fetch SPY desde data912 usando el helper
    const fetchSpyHistory = async () => {
        try {
            const data = await data912.getHistorical('SPY', startDate);
            
            // Transformar datos de data912 al formato esperado (date + c=close)
            return data.map(item => ({
                date: item.date,
                price: item.c  // 'c' es el campo de cierre (close)
            })).sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            console.error("Error fetching SPY:", error);
            return [];
        }
    };

    // Procesar datos para el gráfico (base 100 desde fecha inicio)
    const processedData = useMemo(() => {
        if (!vcpHistory.length || !mepHistory.length || !spyHistory.length) return [];

        const effectiveEndDate = useTodayAsEnd 
            ? new Date().toISOString().split('T')[0] 
            : endDate;

        // Encontrar valores iniciales
        const startVCP = vcpHistory.find(h => h.date >= startDate) || vcpHistory[0];
        const startMEP = mepHistory.find(h => h.date >= startDate) || mepHistory[0];
        const startSPY = spyHistory.find(h => h.date >= startDate) || spyHistory[0];

        if (!startVCP || !startMEP || !startSPY) return [];

        // Validar que los precios iniciales no sean 0 (evitar división por cero)
        if (!startVCP.vcp || !startMEP.price || !startSPY.price) {
            console.warn('[AnalisisReal] Precios iniciales inválidos:', {
                vcp: startVCP.vcp,
                mep: startMEP.price,
                spy: startSPY.price
            });
            return [];
        }

        // Crear mapa de fechas para lookups
        const mepMap = new Map(mepHistory.map(h => [h.date, h.price]));
        const spyMap = new Map(spyHistory.map(h => [h.date, h.price]));

        // Procesar solo datos desde fecha inicio hasta fecha fin
        return vcpHistory
            .filter(h => h.date >= startDate && h.date <= effectiveEndDate)
            .map(h => {
                const date = h.date;
                
                // Normalizar a base 100
                const fciIndex = (h.vcp / startVCP.vcp) * 100;
                
                // Buscar MEP más cercano (O(1) o O(k) con k <= 10)
                const mepPrice = findClosestPrice(date, mepMap);
                const mepIndex = mepPrice ? (mepPrice / startMEP.price) * 100 : null;

                // Buscar SPY más cercano (O(1) o O(k) con k <= 10)
                const spyPrice = findClosestPrice(date, spyMap);
                const spyIndex = spyPrice ? (spyPrice / startSPY.price) * 100 : null;

                return {
                    date,
                    fci: fciIndex,
                    mep: mepIndex,
                    spy: spyIndex
                };
            })
            .filter(h => h.fci !== null);
    }, [vcpHistory, mepHistory, spyHistory, startDate, endDate, useTodayAsEnd]);

    // Procesar datos para el gráfico FCI ARS vs USD (base 100)
    const { data: fciRealSeries, hasUsd: fciHasUsd } = useMemo(() => {
        if (!vcpHistory.length) return { data: [], hasUsd: false };

        const effectiveEndDate = useTodayAsEnd 
            ? new Date().toISOString().split('T')[0] 
            : endDate;

        const vcpRange = vcpHistory.filter(h => h.date >= startDate && h.date <= effectiveEndDate);
        if (!vcpRange.length) return { data: [], hasUsd: false };

        // Orden ascendente para forward-fill del MEP
        const mepAsc = [...mepHistory].sort((a, b) => a.date.localeCompare(b.date));
        let mepIdx = 0;
        let lastMep = null;

        const raw = vcpRange.map(h => {
            while (mepIdx < mepAsc.length && mepAsc[mepIdx].date <= h.date) {
                lastMep = mepAsc[mepIdx].price;
                mepIdx++;
            }

            const fciArs = h.vcp;
            const fciUsd = lastMep ? (h.vcp / lastMep) : null;

            return {
                date: h.date,
                fciArs,
                fciUsd
            };
        });

        const baseArs = raw[0]?.fciArs || null;
        const baseUsdEntry = raw.find(r => r.fciUsd !== null);
        const baseUsd = baseUsdEntry ? baseUsdEntry.fciUsd : null;

        const data = raw.map(r => ({
            date: r.date,
            fci_ars: baseArs ? (r.fciArs / baseArs) * 100 : null,
            fci_usd: baseUsd ? (r.fciUsd / baseUsd) * 100 : null
        }));

        return {
            data,
            hasUsd: Boolean(baseUsd)
        };
    }, [vcpHistory, mepHistory, startDate, endDate, useTodayAsEnd]);

    useEffect(() => {
        if (fciCurrencyMode === 'USD' && !fciHasUsd) {
            setFciCurrencyMode('ARS');
        }
    }, [fciCurrencyMode, fciHasUsd]);

    const fciRealStats = useMemo(() => {
        if (!fciRealSeries.length) return null;

        const key = fciCurrencyMode === 'USD' ? 'fci_usd' : 'fci_ars';
        const first = fciRealSeries.find(d => d[key] !== null && d[key] !== undefined);
        const last = [...fciRealSeries].reverse().find(d => d[key] !== null && d[key] !== undefined);

        if (!first || !last) return null;

        const firstValue = first[key];
        const lastValue = last[key];
        if (!firstValue || !lastValue) return null;

        const start = new Date(first.date);
        const end = new Date(last.date);
        const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));

        const accumulatedPct = lastValue - 100;
        const tna = (Math.pow(lastValue / firstValue, 365 / days) - 1) * 100;

        return {
            accumulatedPct,
            tna,
            days
        };
    }, [fciRealSeries, fciCurrencyMode]);

    // Calcular valores finales para la tabla comparativa
    const comparisonData = useMemo(() => {
        if (!processedData.length) return [];

        const latest = processedData[processedData.length - 1];
        const data = [];

        // FCI
        if (latest.fci) {
            const finalValue = initialAmount * (latest.fci / 100);
            const return_pct = latest.fci - 100;
            data.push({
                name: selectedFci ? selectedFci.nombre : 'FCI',
                color: COLORS.fci,
                finalValue,
                return_pct,
                isWinner: false
            });
        }

        // MEP
        if (latest.mep) {
            const finalValue = initialAmount * (latest.mep / 100);
            const return_pct = latest.mep - 100;
            data.push({
                name: 'Dólar MEP',
                color: COLORS.mep,
                finalValue,
                return_pct,
                isWinner: false
            });
        }

        // SPY
        if (latest.spy) {
            const finalValue = initialAmount * (latest.spy / 100);
            const return_pct = latest.spy - 100;
            data.push({
                name: 'SPY (CEDEAR)',
                color: COLORS.spy,
                finalValue,
                return_pct,
                isWinner: false
            });
        }

        // Ordenar de mejor a peor rendimiento
        const sorted = data.sort((a, b) => b.return_pct - a.return_pct);
        
        // Marcar ganador
        if (sorted.length > 0) {
            sorted[0].isWinner = true;
        }

        return sorted;
    }, [processedData, initialAmount, selectedFci]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Componente de error reutilizable
    const ErrorBanner = () => error ? (
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-loss flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-medium text-loss">{error}</p>
                <p className="text-xs text-text-tertiary mt-1">
                    Verificá tu conexión o intentá de nuevo más tarde.
                </p>
            </div>
        </div>
    ) : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="text-profit" />
                        Comparador de Inversiones
                    </h1>
                    <p className="text-text-tertiary text-xs">
                        ¿Dónde te convenía invertir? Compará el rendimiento histórico
                    </p>
                </div>
            </header>

            {/* Error Banner */}
            <ErrorBanner />

            {/* Controles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Fecha Inicio */}
                <div className="bg-background-secondary p-4 rounded-xl border border-border-primary space-y-2">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase">
                        Fecha Inicio
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-background-tertiary border border-border-secondary rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                {/* Fecha Fin */}
                <div className="bg-background-secondary p-4 rounded-xl border border-border-primary space-y-2">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase">
                        Fecha Fin
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={useTodayAsEnd}
                            className="w-full bg-background-tertiary border border-border-secondary rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useTodayAsEnd}
                            onChange={(e) => setUseTodayAsEnd(e.target.checked)}
                            className="rounded border-border-secondary"
                        />
                        <span className="text-text-secondary">Hasta hoy</span>
                    </label>
                </div>

                {/* Monto Inicial */}
                <div className="bg-background-secondary p-4 rounded-xl border border-border-primary space-y-2">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase">
                        Monto Inicial (ARS)
                    </label>
                    <div className="relative">
                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                            type="number"
                            value={initialAmount}
                            onChange={(e) => setInitialAmount(Number(e.target.value))}
                            className="w-full bg-background-tertiary border border-border-secondary rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                            min="0"
                            step="1000"
                        />
                    </div>
                </div>

                {/* Selector de FCI */}
                <div className="bg-background-secondary p-4 rounded-xl border border-border-primary space-y-2">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase">
                        Fondo (FCI)
                    </label>
                    <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <select
                            value={selectedFci?.id || ''}
                            onChange={(e) => {
                                const fci = fcis.find(f => f.id === e.target.value);
                                setSelectedFci(fci || null);
                            }}
                            className="w-full bg-background-tertiary border border-border-secondary rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer"
                            disabled={fcis.length === 0}
                        >
                            {fcis.length === 0 ? (
                                <option value="">Cargando...</option>
                            ) : (
                                <>
                                    <option value="">Seleccionar FCI</option>
                                    {fcis.map(fci => (
                                        <option key={fci.id} value={fci.id}>
                                            {fci.nombre}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>
                </div>

            </div>

            {/* Gráfico */}
            <div className="bg-background-secondary rounded-2xl border border-border-primary p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-base font-bold flex items-center gap-2">
                        <BarChart3 className="text-primary w-5 h-5" />
                        Evolución del Rendimiento (%)
                    </h2>
                    <p className="text-xs text-text-tertiary">
                        Base 100 = $ {formatNumber(initialAmount, 0)} al {new Date(startDate).toLocaleDateString('es-AR')}
                    </p>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={processedData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                fontSize={10}
                                tickFormatter={(str) => {
                                    const d = new Date(str);
                                    return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                                }}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={10}
                                domain={['auto', 'auto']}
                                tickFormatter={(val) => `${val.toFixed(0)}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '11px' }}
                                itemStyle={{ fontSize: '12px' }}
                                formatter={(value) => [`${value?.toFixed(2)}`, '']}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Line 
                                type="monotone" 
                                dataKey="fci" 
                                name={selectedFci ? selectedFci.nombre : 'FCI'} 
                                stroke={COLORS.fci} 
                                strokeWidth={3} 
                                dot={false} 
                                activeDot={{ r: 6 }} 
                            />
                            <Line 
                                type="monotone" 
                                dataKey="mep" 
                                name="Dólar MEP" 
                                stroke={COLORS.mep} 
                                strokeWidth={2} 
                                dot={false} 
                            />
                            <Line 
                                type="monotone" 
                                dataKey="spy" 
                                name="SPY (CEDEAR)" 
                                stroke={COLORS.spy} 
                                strokeWidth={2} 
                                dot={false} 
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Evolución real del FCI */}
            <div className="bg-background-secondary rounded-2xl border border-border-primary p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-8">
                    <div>
                        <h2 className="text-base font-bold flex items-center gap-2">
                            <BarChart3 className="text-primary w-5 h-5" />
                            Evolución real del FCI
                        </h2>
                        <p className="text-xs text-text-tertiary">
                            Comparación del valor del fondo en pesos y en dólares MEP
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {fciRealStats && (
                            <div className="flex items-center gap-2">
                                <div className="bg-background-tertiary border border-border-secondary rounded-lg px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">TNA</p>
                                    <p className={`text-sm font-mono font-bold ${fciRealStats.tna >= 0 ? 'text-profit' : 'text-loss'}`}>
                                        {formatPercent(fciRealStats.tna)}
                                    </p>
                                </div>
                                <div className="bg-background-tertiary border border-border-secondary rounded-lg px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Acumulado</p>
                                    <p className={`text-sm font-mono font-bold ${fciRealStats.accumulatedPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                                        {formatPercent(fciRealStats.accumulatedPct)}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="inline-flex rounded-lg bg-background-tertiary p-1 border border-border-secondary">
                            <button
                                onClick={() => setFciCurrencyMode('ARS')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                    fciCurrencyMode === 'ARS'
                                        ? 'bg-text-primary text-background-primary'
                                        : 'text-text-tertiary hover:text-text-primary'
                                }`}
                            >
                                ARS
                            </button>
                            <button
                                onClick={() => fciHasUsd && setFciCurrencyMode('USD')}
                                disabled={!fciHasUsd}
                                title={
                                    fciHasUsd
                                        ? 'USD = valor del FCI dividido por el dólar MEP del mismo día'
                                        : 'USD = valor del FCI dividido por el dólar MEP del mismo día. No hay datos de MEP disponibles.'
                                }
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                    fciCurrencyMode === 'USD'
                                        ? 'bg-text-primary text-background-primary'
                                        : 'text-text-tertiary hover:text-text-primary'
                                } ${!fciHasUsd ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                USD
                            </button>
                        </div>
                        {!fciHasUsd && (
                            <span className="text-[10px] text-text-tertiary">
                                MEP no disponible
                            </span>
                        )}
                    </div>
                </div>

                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={fciRealSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                fontSize={10}
                                tickFormatter={(str) => {
                                    const d = new Date(str);
                                    return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                                }}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={10}
                                domain={['auto', 'auto']}
                                tickFormatter={(val) => `${val.toFixed(0)}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '11px' }}
                                itemStyle={{ fontSize: '12px' }}
                                formatter={(value) => [`${value?.toFixed(2)}`, '']}
                            />
                            <Legend verticalAlign="top" height={36} />
                            {fciCurrencyMode === 'ARS' ? (
                                <Line 
                                    type="monotone" 
                                    dataKey="fci_ars" 
                                    name={selectedFci ? `${selectedFci.nombre} (ARS)` : 'FCI (ARS)'} 
                                    stroke={COLORS.fciArs} 
                                    strokeWidth={3} 
                                    dot={false} 
                                    activeDot={{ r: 6 }} 
                                />
                            ) : (
                                <Line 
                                    type="monotone" 
                                    dataKey="fci_usd" 
                                    name={selectedFci ? `${selectedFci.nombre} (USD MEP)` : 'FCI (USD MEP)'} 
                                    stroke={COLORS.fciUsd} 
                                    strokeWidth={3} 
                                    dot={false} 
                                    activeDot={{ r: 6 }} 
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Tabla Comparativa */}
            <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
                <div className="p-4 border-b border-border-primary">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-text-tertiary" />
                        Resultado Final: ¿Dónde te convenía invertir?
                    </h3>
                    <p className="text-xs text-text-tertiary mt-1">
                        Si invertías $ {formatNumber(initialAmount, 0)} el {new Date(startDate).toLocaleDateString('es-AR')}:
                    </p>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-background-tertiary">
                        <tr className="text-left text-text-tertiary text-[10px] uppercase font-bold tracking-wider">
                            <th className="px-4 py-3">Activo</th>
                            <th className="px-4 py-3 text-right">Valor Final</th>
                            <th className="px-4 py-3 text-right">Rendimiento</th>
                            <th className="px-4 py-3 text-center">Resultado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-primary">
                        {comparisonData.map((item, index) => (
                            <tr 
                                key={item.name} 
                                className={item.isWinner ? 'bg-profit/10' : ''}
                            >
                                <td className="px-4 py-3 font-semibold flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                    {item.name}
                                    {item.isWinner && <span className="text-profit">🏆</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold">
                                    $ {formatNumber(item.finalValue, 0)}
                                </td>
                                <td className={`px-4 py-3 text-right font-mono ${item.return_pct >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    {formatPercent(item.return_pct)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {item.isWinner ? (
                                        <span className="text-xs font-bold text-profit bg-profit/20 px-2 py-1 rounded">
                                            MEJOR OPCIÓN
                                        </span>
                                    ) : (
                                        <span className="text-xs text-text-tertiary">
                                            {index === 1 ? '2° lugar' : index === 2 ? '3° lugar' : `${index + 1}° lugar`}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AnalisisRealContent;
