import React, { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { Target } from 'lucide-react';
import { formatARS, formatUSD } from '../../../utils/formatters';

const RiskConcentrationChart = ({ positions, currency = 'ARS' }) => {
    const chartData = useMemo(() => {
        return positions.map(p => ({
            name: p.ticker,
            size: currency === 'ARS' ? p.valuacionActual : p.valuacionUSD,
            pnl: p.resultadoPct
        }));
    }, [positions, currency]);

    const CustomizedContent = (props) => {
        const { root, depth, x, y, width, height, index, payload, colors, rank, name } = props;

        // Only show text if box is big enough
        const showText = width > 40 && height > 20;

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                        fill: payload?.pnl >= 0 ? '#10b981' : '#ef4444',
                        fillOpacity: 0.8,
                        stroke: '#111827',
                        strokeWidth: 2 / (depth + 1),
                        strokeOpacity: 1,
                    }}
                />
                {showText && (
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={12}
                        fontWeight="bold"
                        className="pointer-events-none"
                    >
                        {name}
                    </text>
                )}
            </g>
        );
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-background-secondary border border-border-primary rounded-lg p-2 shadow-xl">
                    <p className="text-text-primary font-semibold text-xs mb-1">{data.name}</p>
                    <p className="text-text-secondary text-xs">
                        Valuación: {currency === 'ARS' ? formatARS(data.value) : formatUSD(data.value)}
                    </p>
                    <p className={`text-xs font-bold ${data?.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        P&L: {data?.pnl?.toFixed(2) || '0.00'}%
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
                <div className="p-1.5 bg-danger/20 rounded">
                    <Target className="w-4 h-4 text-danger" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">Concentración de Riesgo (Treemap)</h3>
            </div>

            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={chartData}
                        dataKey="size"
                        ratio={4 / 3}
                        stroke="#fff"
                        fill="#8884d8"
                        content={<CustomizedContent />}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default RiskConcentrationChart;
