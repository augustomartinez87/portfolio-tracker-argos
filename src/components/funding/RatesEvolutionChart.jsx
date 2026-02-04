import React, { useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, ReferenceArea
} from 'recharts';
import { useHistoricalRates } from '@/hooks/useHistoricalRates';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Target, Zap, AlertCircle } from 'lucide-react';

const PERIODS = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
    { label: '180d', value: 180 },
    { label: 'Todo', value: 1000 },
];

export function RatesEvolutionChart({ fciId, portfolioId, userId }) {
    const [period, setPeriod] = useState(30);
    const { data, loading, error, stats } = useHistoricalRates(fciId, portfolioId, userId, period);

    if (loading) {
        return (
            <div className="bg-background-secondary rounded-xl p-8 border border-border-primary border-dashed flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-text-secondary">Cargando datos históricos...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-background-secondary rounded-xl p-8 border border-border-primary border-dashed flex flex-col items-center justify-center min-h-[400px]">
                <AlertCircle className="w-12 h-12 text-danger mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">Error al cargar datos</h3>
                <p className="text-text-secondary text-center max-w-sm">{error}</p>
            </div>
        );
    }

    if (!data || data.length < 7) {
        return (
            <div className="bg-background-secondary rounded-xl p-8 border border-border-primary border-dashed flex flex-col items-center justify-center min-h-[400px]">
                <BarChartIcon className="w-12 h-12 text-text-tertiary mb-4 opacity-20" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">Datos insuficientes</h3>
                <p className="text-text-secondary text-center max-w-sm">
                    No hay suficientes datos históricos para este período.
                    Se requieren al menos 7 días de datos de VCP y Cauciones.
                </p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background-tertiary border border-border-primary p-3 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="text-xs text-text-tertiary mb-2 font-medium">
                        {format(new Date(label), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-xs text-success font-medium">TNA FCI:</span>
                            <span className="text-xs font-mono font-bold text-text-primary">{payload[0].value}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-xs text-danger font-medium">TNA Caución:</span>
                            <span className="text-xs font-mono font-bold text-text-primary">{payload[1].value}%</span>
                        </div>
                        <div className="pt-1 mt-1 border-t border-border-secondary flex justify-between gap-4">
                            <span className="text-xs text-primary font-bold">Spread:</span>
                            <span className="text-xs font-mono font-bold text-primary">
                                {(payload[0].value - payload[1].value).toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="bg-background-secondary rounded-xl p-6 border border-border-primary">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <span className="text-xl">📉</span> EVOLUCIÓN TNA FCI vs TNA CAUCIÓN
                        </h3>
                        <p className="text-sm text-text-tertiary">Comparativa de tasas y spread histórico</p>
                    </div>

                    <div className="flex bg-background-tertiary p-1 rounded-lg border border-border-secondary self-start">
                        {PERIODS.map(p => (
                            <button
                                key={p.label}
                                onClick={() => setPeriod(p.value)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${period === p.value
                                        ? 'bg-primary text-background-primary shadow-sm'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorFci" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCaucion" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-info)" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="var(--color-info)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
                            <XAxis
                                dataKey="fecha"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                                tickFormatter={(str) => format(new Date(str), 'd MMM', { locale: es })}
                                minTickGap={30}
                            />
                             <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                                tickFormatter={(val) => `${val}%`}
                                domain={['dataMin - 2', 'dataMax + 2']}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="top" height={36} iconType="circle" />

                            <Area
                                type="monotone"
                                dataKey="tnaFCI"
                                name="TNA FCI"
                                stroke="var(--color-success)"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorFci)"
                                activeDot={{ r: 4, stroke: 'var(--color-success)', strokeWidth: 2, fill: 'var(--bg-primary)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="tnaCaucion"
                                name="TNA Caución"
                                stroke="var(--color-danger)"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorCaucion)"
                                activeDot={{ r: 4, stroke: 'var(--color-danger)', strokeWidth: 2, fill: 'var(--bg-primary)' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="SPREAD PROM."
                        value={`${stats.spreadPromedio}%`}
                        subtitle={`en el período de ${period === 1000 ? 'todo el histórico' : period + ' días'}`}
                        icon={<TrendingUp className="w-5 h-5 text-primary" />}
                    />
                    <StatCard
                        title="SPREAD MÁX"
                        value={`${stats.spreadMax.valor}%`}
                        subtitle={format(new Date(stats.spreadMax.fecha), "dd MMM yy", { locale: es })}
                        icon={<Zap className="w-5 h-5 text-warning" />}
                    />
                    <StatCard
                        title="SPREAD MÍN"
                        value={`${stats.spreadMin.valor}%`}
                        subtitle={format(new Date(stats.spreadMin.fecha), "dd MMM yy", { locale: es })}
                        icon={<TrendingDown className="w-5 h-5 text-danger" />}
                    />
                    <StatCard
                        title="SPREAD ACTUAL"
                        value={`${stats.spreadActual}%`}
                        subtitle={`Percentil: ${stats.percentilActual}%`}
                        icon={<Target className="w-5 h-5 text-success" />}
                        highlight={true}
                    />
                </div>
            )}
        </div>
    );
}

function StatCard({ title, value, subtitle, icon, highlight = false }) {
    return (
        <div className={`bg-background-secondary p-5 rounded-xl border ${highlight ? 'border-primary/30 shadow-lg shadow-primary/5' : 'border-border-primary'}`}>
            <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary">{title}</span>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-mono font-bold text-text-primary leading-none mb-1">{value}</span>
                <span className="text-xs text-text-tertiary">{subtitle}</span>
            </div>
        </div>
    );
}

function BarChartIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
    );
}
