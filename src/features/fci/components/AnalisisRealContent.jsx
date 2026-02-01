import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    TrendingUp, Calendar, BarChart3, RefreshCw, Wallet
} from 'lucide-react';
import { formatARS, formatPercent } from '@/utils/formatters';
import { mepService } from '@/features/portfolio/services/mepService';
import { fciService } from '@/features/fci/services/fciService';
import { data912 } from '@/utils/data912';

const COLORS = {
    fci: '#3b82f6',    // Blue
    mep: '#ef4444',    // Red
    spy: '#10b981',    // Green
};

const AnalisisRealContent = () => {
    // Estados principales
    const [startDate, setStartDate] = useState('2025-01-01');
    const [endDate, setEndDate] = useState('');
    const [useTodayAsEnd, setUseTodayAsEnd] = useState(true);
    const [initialAmount, setInitialAmount] = useState(1000000);
    const [vcpHistory, setVcpHistory] = useState([]);
    const [spyHistory, setSpyHistory] = useState([]);
    const [mepHistory, setMepHistory] = useState([]);
    const [fcis, setFcis] = useState([]);
    const [selectedFci, setSelectedFci] = useState(null);
    const [loading, setLoading] = useState(true);

    // Función auxiliar para encontrar precio más cercano (definida antes de usarla)
    const findClosestPrice = (targetDate, priceMap, historyArray) => {
        if (priceMap.has(targetDate)) return priceMap.get(targetDate);
        
        // Buscar el precio de la fecha más cercana anterior
        const sortedDates = historyArray.map(h => h.date).sort();
        const targetIndex = sortedDates.findIndex(d => d > targetDate);
        
        if (targetIndex > 0) {
            const closestDate = sortedDates[targetIndex - 1];
            return priceMap.get(closestDate);
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
        const loadFcis = async () => {
            try {
                const data = await fciService.getFcis();
                setFcis(data || []);
                
                if (data && data.length === 1) {
                    setSelectedFci(data[0]);
                }
            } catch (error) {
                console.error("Error loading FCIs:", error);
            }
        };
        loadFcis();
    }, []);

    // Cargar datos históricos (SPY y MEP)
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [mep, spyData] = await Promise.all([
                    mepService.getHistory(),
                    fetchSpyHistory()
                ]);
                setMepHistory(mep);
                setSpyHistory(spyData);
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [startDate]);

    // Cargar precios del FCI seleccionado
    useEffect(() => {
        const loadFciPrices = async () => {
            if (!selectedFci) return;
            
            try {
                const prices = await fciService.getPrices(selectedFci.id);
                if (prices && prices.length > 0) {
                    const parsedVCP = prices.map(p => ({
                        date: p.fecha,
                        vcp: p.vcp
                    })).sort((a, b) => a.date.localeCompare(b.date));
                    setVcpHistory(parsedVCP);
                }
            } catch (error) {
                console.error("Error loading FCI prices:", error);
            }
        };
        loadFciPrices();
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
                
                // Buscar MEP más cercano
                const mepPrice = findClosestPrice(date, mepMap, mepHistory);
                const mepIndex = mepPrice ? (mepPrice / startMEP.price) * 100 : null;
                
                // Buscar SPY más cercano
                const spyPrice = findClosestPrice(date, spyMap, spyHistory);
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

            </div>

            {/* Gráfico */}
            <div className="bg-background-secondary rounded-2xl border border-border-primary p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-base font-bold flex items-center gap-2">
                        <BarChart3 className="text-primary w-5 h-5" />
                        Evolución del Rendimiento (%)
                    </h2>
                    <p className="text-xs text-text-tertiary">
                        Base 100 = {formatARS(initialAmount, 0)} al {new Date(startDate).toLocaleDateString('es-AR')}
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

            {/* Tabla Comparativa */}
            <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
                <div className="p-4 border-b border-border-primary">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-text-tertiary" />
                        Resultado Final: ¿Dónde te convenía invertir?
                    </h3>
                    <p className="text-xs text-text-tertiary mt-1">
                        Si invertías {formatARS(initialAmount, 0)} el {new Date(startDate).toLocaleDateString('es-AR')}:
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
                                    {formatARS(item.finalValue, 0)}
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