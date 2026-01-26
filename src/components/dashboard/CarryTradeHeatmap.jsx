
import React, { useEffect, useState, useMemo } from 'react';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { usePrices } from '../../services/priceService';
import { macroCarryEngine } from '../../services/macroCarryEngine';
import { formatPercent, formatARS } from '../../utils/formatters';
import { Loader2, TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-background-secondary border border-border-primary p-3 rounded-lg shadow-xl text-xs z-50">
                <p className="font-bold text-text-primary mb-2 text-sm">{data.ticker} <span className="text-text-tertiary font-normal">({data.instrumentType})</span></p>
                <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                        <span className="text-text-tertiary">Precio (ARS):</span>
                        <span className="font-mono text-text-primary">{formatARS(data.marketPrice)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-text-tertiary">Tasa Implícita (ARS):</span>
                        <span className="font-mono text-text-primary">{formatPercent(data.impliedYieldArs * 100)}</span>
                    </div>
                    <div className="border-t border-border-primary my-1 pt-1 flex justify-between gap-4 font-bold">
                        <span>Carry USD (Stable FX):</span>
                        <span className={`font-mono ${data.impliedYieldUsd >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatPercent(data.impliedYieldUsd * 100)}
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-text-tertiary">Score:</span>
                        <span className="font-mono text-text-primary">{Math.round(data.carryScore)}/100</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const CustomizedContent = (props) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name } = props;

    // Safety check to prevent "Cannot read properties of undefined (reading 'fill')"
    if (!payload) return null;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: payload.fill,
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
                rx={4}
                ry={4}
            />
            {width > 35 && height > 30 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={Math.min(width / 4, 14)}
                    fontWeight="bold"
                    style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                >
                    {name}
                </text>
            )}
            {width > 50 && height > 50 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 16}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={10}
                    opacity={0.9}
                    style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                >
                    {formatPercent(payload.impliedYieldUsd * 100)}
                </text>
            )}
        </g>
    );
};

export const CarryTradeHeatmap = ({ positions }) => {
    const { currentPortfolio } = usePortfolio();
    const { prices, mepRate } = usePrices();
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchMetrics = async () => {
            setLoading(true);
            try {
                // Pass live prices and MEP to engine
                const result = await macroCarryEngine.calculateMacroCarry(positions || [], prices, mepRate);
                if (result.success) {
                    setMetrics(result.data);
                }
            } catch (err) {
                console.error("Failed to load macro carry metrics", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [positions, currentPortfolio, prices, mepRate]);

    const getColor = (usdYield) => {
        // USD Carry ranges. > 5% real USD is great.
        // Normalized: 0.15 max.
        const maxReference = 0.15;
        const netCarry = usdYield;

        if (netCarry >= 0) {
            if (netCarry > 0.10) return '#16a34a'; // green-600
            if (netCarry > 0.05) return '#22c55e'; // green-500
            return '#4ade80'; // green-400
        } else {
            if (netCarry < -0.10) return '#dc2626'; // red-600
            if (netCarry < -0.05) return '#ef4444'; // red-500
            return '#f87171'; // red-400
        }
    };

    const data = useMemo(() => {
        return metrics.map(m => ({
            name: m.ticker,
            size: 100,
            impliedYieldUsd: m.impliedYieldUsd,
            ...m,
            fill: getColor(m.impliedYieldUsd)
        }));
    }, [metrics]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-background-secondary rounded-xl border border-border-primary">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-text-tertiary">Calculando Macro Carry...</span>
            </div>
        );
    }

    if (!metrics || metrics.length === 0) return null;

    return (
        <div className="bg-background-secondary border border-border-primary rounded-xl p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/20 rounded">
                        <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-text-primary">Macro Carry (USD)</h3>
                        <p className="text-[10px] text-text-tertiary">Implícito a FX Estable</p>
                    </div>
                </div>
                <div className="flex text-xs gap-3">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-success"></div>
                        <span className="text-text-tertiary">Rend. +</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-danger"></div>
                        <span className="text-text-tertiary">Rend. -</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={data}
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

export default CarryTradeHeatmap;
