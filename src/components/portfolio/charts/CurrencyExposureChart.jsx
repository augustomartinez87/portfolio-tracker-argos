import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { formatARS, formatUSD } from '../../../utils/formatters';

const COLORS = {
    'Dólar': '#f59e0b',      // Amber
    'CER': '#a855f7',        // Purple
    'Pesos': '#6366f1',      // Indigo
};

const getCurrencyType = (ticker, assetClass) => {
    const t = ticker.toUpperCase();
    if (assetClass === 'CEDEAR' || assetClass === 'BONO HARD DOLLAR') return 'Dólar';
    if (assetClass === 'ON') {
        return t.endsWith('O') ? 'Pesos' : 'Dólar';
    }
    if (assetClass === 'BONOS PESOS') {
        const cerTickers = ['DICP', 'PARP', 'CUAP', 'PR13', 'TX', 'T2X', 'T3X', 'T4X', 'T5X', 'TC25', 'BRL1'];
        if (cerTickers.some(cer => t.includes(cer))) return 'CER';
        return 'Pesos';
    }
    return 'Pesos';
};

const CurrencyExposureChart = ({ positions, currency = 'ARS' }) => {
    const chartData = useMemo(() => {
        const grouped = positions.reduce((acc, pos) => {
            const type = getCurrencyType(pos.ticker, pos.assetClass);
            const value = currency === 'ARS' ? pos.valuacionActual : pos.valuacionUSD;

            if (!acc[type]) acc[type] = 0;
            acc[type] += value;
            return acc;
        }, {});

        const total = Object.values(grouped).reduce((a, b) => a + b, 0);

        return Object.entries(grouped)
            .map(([name, value]) => ({
                name,
                value,
                percentage: total > 0 ? (value / total) * 100 : 0
            }))
            .sort((a, b) => b.value - a.value);
    }, [positions, currency]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-background-secondary border border-border-primary rounded-lg p-2 shadow-xl">
                    <p className="text-text-primary font-semibold text-xs mb-1">{data?.name || '---'}</p>
                    <p className="text-text-secondary text-xs">
                        {currency === 'ARS' ? formatARS(data?.value || 0) : formatUSD(data?.value || 0)}
                    </p>
                    <p className="text-primary text-xs font-bold">{data?.percentage?.toFixed(1) || '0.0'}%</p>
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
                    <ShieldCheck className="w-4 h-4 text-warning" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">Exposición Cambiaria / Cobertura</h3>
            </div>

            <div className="flex-1 min-h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6b7280'} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default CurrencyExposureChart;
