import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    Activity, ArrowUpRight, ArrowDownRight, Upload, Calendar,
    BarChart3, RefreshCw, Info, ChevronDown, ChevronUp, TrendingUp
} from 'lucide-react';
import { formatARS, formatPercent, formatNumber } from '../../utils/formatters';
import { macroService } from '../../services/macroService';
import { mepService } from '../../services/mepService';
import { usePortfolio } from '../../contexts/PortfolioContext';
import Papaparse from 'papaparse';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';

const COLORS = {
    fci: '#3b82f6',    // Blue
    mep: '#ef4444',    // Red
    spy: '#10b981',    // Green
    ibit: '#f59e0b',   // Orange
    ipc: '#94a3b8',    // Gray
};

export const AnalisisRealContent = () => {
    const { currentPortfolio } = usePortfolio();

    // States
    const [subDate, setSubDate] = useState('2023-12-01');
    const [cuotapartes, setCuotapartes] = useState(5963821);
    const [vcpHistory, setVcpHistory] = useState([]);
    const [ipcData, setIpcData] = useState([]);
    const [benchmarks, setBenchmarks] = useState({ spy: [], ibit: [] });
    const [mepHistory, setMepHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('nominal'); // 'nominal' | 'real'
    const [showBenchmarks, setShowBenchmarks] = useState({
        mep: true,
        spy: true,
        ibit: true,
        ipc: true
    });

    // Excel Serial Date to JS Date
    const excelToJSDate = (serial) => {
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return date_info.toISOString().split('T')[0];
    };

    // Load Initial Data
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [ipc, mep] = await Promise.all([
                    macroService.getIPC(),
                    mepService.getHistory()
                ]);
                setIpcData(ipc);
                setMepHistory(mep);

                // Load benchmarks in background
                const [spy, ibit] = await Promise.all([
                    macroService.getBenchmarkInARS('SPY', mep),
                    macroService.getBenchmarkInARS('IBIT', mep)
                ]);
                setBenchmarks({ spy, ibit });
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    // Handle CSV/Excel Upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            const parsedVCP = data.map(row => {
                const dateRaw = row.Fecha || row.Date || row.fecha;
                const vcpRaw = row.ValorCuotaparte || row.VCP || row.valor;

                let date = '';
                if (typeof dateRaw === 'number') {
                    date = excelToJSDate(dateRaw);
                } else {
                    date = new Date(dateRaw).toISOString().split('T')[0];
                }

                return {
                    date,
                    vcp: parseFloat(vcpRaw)
                };
            }).sort((a, b) => a.date.localeCompare(b.date));

            setVcpHistory(parsedVCP);
        };
        reader.readAsBinaryString(file);
    };

    const processedData = useMemo(() => {
        if (!vcpHistory.length || !ipcData.length) return [];

        const startVCP = vcpHistory.find(h => h.date >= subDate) || vcpHistory[0];
        const startMEP = mepService.findClosestRate(subDate, mepHistory);
        const startSPY = benchmarks.spy.find(h => h.date >= subDate) || benchmarks.spy[0];
        const startIBIT = benchmarks.ibit.find(h => h.date >= subDate) || benchmarks.ibit[0];

        return vcpHistory.filter(h => h.date >= subDate).map(h => {
            const date = h.date;
            const nomFCI = (h.vcp / startVCP.vcp);
            const currentMEP = mepService.findClosestRate(date, mepHistory);
            const nomMEP = (currentMEP / startMEP);
            const spyData = benchmarks.spy.find(s => s.date === date) || { priceARS: startSPY?.priceARS };
            const nomSPY = (spyData.priceARS / (startSPY?.priceARS || 1));
            const ibitData = benchmarks.ibit.find(i => i.date === date) || { priceARS: startIBIT?.priceARS };
            const nomIBIT = (ibitData.priceARS / (startIBIT?.priceARS || 1));
            const ipcAcum = 1 + macroService.calculateAccumulatedIPC(subDate, date, ipcData);

            return {
                date,
                fci: nomFCI * 100,
                mep: nomMEP * 100,
                spy: nomSPY * 100,
                ibit: nomIBIT * 100,
                ipc: ipcAcum * 100,
                fci_real: (nomFCI / ipcAcum) * 100,
                mep_real: (nomMEP / ipcAcum) * 100,
                spy_real: (nomSPY / ipcAcum) * 100,
                ibit_real: (nomIBIT / ipcAcum) * 100,
                ipc_real: 100
            };
        });
    }, [vcpHistory, ipcData, benchmarks, subDate, mepHistory]);

    const metrics = useMemo(() => {
        if (!processedData.length) return null;
        const latest = processedData[processedData.length - 1];

        return {
            fci: {
                nominal: latest.fci - 100,
                real: latest.fci_real - 100,
                multiple: latest.fci_real / 100
            },
            mep: {
                nominal: latest.mep - 100,
                real: latest.mep_real - 100,
                multiple: latest.mep_real / 100
            },
            ipc: {
                nominal: latest.ipc - 100,
                real: 0
            }
        };
    }, [processedData]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="text-profit" />
                        Análisis Real Adcap Balanceado III
                    </h1>
                    <p className="text-text-tertiary text-xs">Comparativa de rendimiento vs. Inflación y Benchmarks</p>
                </div>

                <div className="flex items-center gap-2 bg-background-secondary p-1 rounded-lg border border-border-primary">
                    <button
                        onClick={() => setViewMode('nominal')}
                        className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'nominal' ? 'bg-primary text-white shadow-lg' : 'text-text-tertiary hover:text-text-primary'}`}
                    >
                        Nominal
                    </button>
                    <button
                        onClick={() => setViewMode('real')}
                        className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'real' ? 'bg-primary text-white shadow-lg' : 'text-text-tertiary hover:text-text-primary'}`}
                    >
                        Real (IPC)
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-background-secondary p-4 rounded-xl border border-border-primary space-y-2">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase">Fecha Suscripción</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                            type="date"
                            value={subDate}
                            onChange={(e) => setSubDate(e.target.value)}
                            className="w-full bg-background-tertiary border border-border-secondary rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <div className="bg-background-secondary p-4 rounded-xl border border-border-primary space-y-2">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase">Cuotapartes Iniciales</label>
                    <input
                        type="number"
                        value={cuotapartes}
                        onChange={(e) => setCuotapartes(e.target.value)}
                        className="w-full bg-background-tertiary border border-border-secondary rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
                    />
                </div>

                <div className="bg-background-secondary p-4 rounded-xl border border-border-primary flex flex-col justify-center gap-2">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase">Cargar VCP (CSV/Excel)</label>
                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-background-tertiary border border-dashed border-border-secondary rounded-lg cursor-pointer hover:border-primary transition-colors text-xs text-text-secondary">
                        <Upload className="w-4 h-4" />
                        Seleccionar Archivo
                        <input type="file" onChange={handleFileUpload} className="hidden" accept=".csv,.xlsx" />
                    </label>
                </div>
            </div>

            <div className="bg-background-secondary rounded-2xl border border-border-primary p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-base font-bold flex items-center gap-2">
                        <BarChart3 className="text-primary w-5 h-5" />
                        Evolución {viewMode === 'real' ? 'Poder de Compra' : 'Patrimonio Nominal'}
                    </h2>
                    <div className="flex gap-2">
                        {Object.keys(showBenchmarks).map(key => (
                            <button
                                key={key}
                                onClick={() => setShowBenchmarks(prev => ({ ...prev, [key]: !prev[key] }))}
                                className={`px-3 py-1 text-[9px] font-bold uppercase rounded-full border transition-all ${showBenchmarks[key] ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-transparent border-border-primary text-text-tertiary'}`}
                            >
                                {key}
                            </button>
                        ))}
                    </div>
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
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Line type="monotone" dataKey={viewMode === 'real' ? 'fci_real' : 'fci'} name="Adcap Balanceado III" stroke={COLORS.fci} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            {showBenchmarks.mep && <Line type="monotone" dataKey={viewMode === 'real' ? 'mep_real' : 'mep'} name="Dólar MEP" stroke={COLORS.mep} strokeWidth={2} dot={false} />}
                            {showBenchmarks.spy && <Line type="monotone" dataKey={viewMode === 'real' ? 'spy_real' : 'spy'} name="SPY (ARS)" stroke={COLORS.spy} strokeWidth={2} dot={false} />}
                            {showBenchmarks.ibit && <Line type="monotone" dataKey={viewMode === 'real' ? 'ibit_real' : 'ibit'} name="IBIT (ARS)" stroke={COLORS.ibit} strokeWidth={2} dot={false} />}
                            {showBenchmarks.ipc && viewMode === 'nominal' && <Line type="monotone" dataKey="ipc" name="IPC (Inflación)" stroke={COLORS.ipc} strokeWidth={2} strokeDasharray="5 5" dot={false} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
                    <div className="p-4 border-b border-border-primary">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                            <Info className="w-4 h-4 text-text-tertiary" />
                            Comparativa de Métricas
                        </h3>
                    </div>
                    <table className="w-full text-xs">
                        <thead className="bg-background-tertiary">
                            <tr className="text-left text-text-tertiary text-[9px] uppercase font-bold tracking-wider">
                                <th className="px-4 py-3">Activo</th>
                                <th className="px-4 py-3 text-right">Nominal %</th>
                                <th className="px-4 py-3 text-right">Real %</th>
                                <th className="px-4 py-3 text-right">Múltiplo Real</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-primary">
                            <tr>
                                <td className="px-4 py-3 font-semibold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.fci }}></div>
                                    FCI Adcap
                                </td>
                                <td className={`px-4 py-3 text-right font-mono ${metrics?.fci.nominal >= 0 ? 'text-profit' : 'text-danger'}`}>
                                    {formatPercent(metrics?.fci.nominal)}
                                </td>
                                <td className={`px-4 py-3 text-right font-mono ${metrics?.fci.real >= 0 ? 'text-profit' : 'text-danger'}`}>
                                    {formatPercent(metrics?.fci.real)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold">
                                    {formatNumber(metrics?.fci.multiple, 2)}x
                                </td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-semibold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.mep }}></div>
                                    Dólar MEP
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-text-primary">
                                    {formatPercent(metrics?.mep.nominal)}
                                </td>
                                <td className={`px-4 py-3 text-right font-mono ${metrics?.mep.real >= 0 ? 'text-profit' : 'text-danger'}`}>
                                    {formatPercent(metrics?.mep.real)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold">
                                    {formatNumber(metrics?.mep.multiple, 2)}x
                                </td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-semibold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.ipc }}></div>
                                    Inflación (IPC)
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-text-primary">
                                    {formatPercent(metrics?.ipc.nominal)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-text-tertiary">0.00%</td>
                                <td className="px-4 py-3 text-right font-mono text-text-tertiary">1.00x</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="bg-[#1e293b] border border-blue-400/20 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Activity className="w-24 h-24" />
                    </div>
                    <h3 className="text-blue-400 font-bold mb-4 uppercase tracking-widest text-[10px]">Automated Alpha Insights</h3>
                    <div className="space-y-4 text-xs leading-relaxed">
                        {metrics ? (
                            <>
                                <p>
                                    Desde tu suscripción el <span className="text-white font-bold">{new Date(subDate).toLocaleDateString()}</span>,
                                    el FCI <span className={metrics.fci.real >= 0 ? 'text-profit' : 'text-danger'}>
                                        {metrics.fci.real >= 0 ? 'gana' : 'pierde'} {formatPercent(Math.abs(metrics.fci.real))} real
                                    </span> frente a una inflación acumulada del <span className="text-white">{formatPercent(metrics.ipc.nominal)}</span>.
                                </p>
                                <p>
                                    Tu poder de compra <span className="text-white">{metrics.fci.multiple >= 1 ? 'creció' : 'disminuyó'} {formatNumber(metrics.fci.multiple, 2)}x</span>.
                                    En el mismo período, el Dólar MEP {metrics.mep.real >= 0 ? 'superó' : 'quedó debajo de'} la inflación por {formatPercent(Math.abs(metrics.mep.real))},
                                    confirmando que el FCI <span className="text-profit">fue una cobertura superior</span> al ahorro en moneda dura.
                                </p>
                            </>
                        ) : (
                            <p className="text-text-tertiary italic">Selecciona una fecha y sube el historial de VCP para generar insights...</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
