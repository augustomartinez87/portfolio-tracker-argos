import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatARS, formatPercent } from '@/utils/formatters';

const TopPerformersChart = ({ positions, currency = 'ARS' }) => {
    const isUSD = currency === 'USD';
    const chartData = useMemo(() => {
        return [...positions]
            .sort((a, b) => {
                const aVal = isUSD ? a.resultPctUSD : a.resultPct;
                const bVal = isUSD ? b.resultPctUSD : b.resultPct;
                return bVal - aVal;
            })
            .slice(0, 10) // Top 10
            .map(p => {
                const value = isUSD ? p.resultPctUSD : p.resultPct;
                return {
                    name: p.ticker,
                    value: value,
                    color: value >= 0 ? '#10b981' : '#ef4444'
                };
            });
    }, [positions, isUSD]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background-secondary border border-border-primary rounded-lg p-2 shadow-xl">
                    <p className="text-text-primary font-semibold text-xs mb-1">{payload[0].payload?.name || '---'}</p>
                    <p className={`text-xs font-bold ${payload[0].value >= 0 ? 'text-profit' : 'text-loss'}`}>
                        P&L: {formatPercent(payload[0].value || 0)}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (chartData.length === 0) return null;

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="p-1.5 bg-background-tertiary rounded">
                    <TrendingUp className="w-4 h-4 text-profit" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">Top Performers (P&L %)</h3>
            </div>

            <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                        <XAxis
                            type="number"
                            stroke="#94a3b8"
                            fontSize={10}
                            tickFormatter={(val) => `${val}%`}
                            domain={['auto', 'auto']}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#94a3b8"
                            fontSize={10}
                            width={50}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TopPerformersChart;
