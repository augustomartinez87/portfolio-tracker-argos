
import React, { useEffect, useState, useMemo } from 'react';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { usePrices } from '../services/priceService';
import { macroCarryEngine } from '../../macro/services/macroCarryEngine';
import { formatPercent, formatARS } from '../../utils/formatters';
import { Loader2, TrendingUp } from 'lucide-react';

const getCarryColor = (carry) => {
    // Colores para heatmap de carry (en porcentaje)
    if (carry >= 5) return 'text-success bg-success/20'; // verde fuerte
    if (carry >= 2) return 'text-success/80 bg-success/10'; // verde medio
    if (carry >= 0) return 'text-success/60 bg-success/5'; // verde claro
    if (carry >= -2) return 'text-warning/80 bg-warning/10'; // amarillo
    if (carry >= -5) return 'text-danger/60 bg-danger/10'; // rojo claro
    return 'text-danger bg-danger/20'; // rojo fuerte
};

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-background-secondary border border-border-primary p-3 rounded-lg shadow-xl text-xs z-50 min-w-[250px]">
                <p className="font-bold text-text-primary mb-2 text-sm">{data.ticker} <span className="text-text-tertiary font-normal">({data.instrumentType})</span></p>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between gap-2">
                            <span className="text-text-tertiary">Precio:</span>
                            <span className="font-mono text-text-primary">{formatARS(data.marketPrice)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span className="text-text-tertiary">Días:</span>
                            <span className="font-mono text-text-primary">{data.daysToMaturity}</span>
                        </div>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-text-tertiary">Vencimiento:</span>
                        <span className="font-mono text-text-primary">{new Date(data.maturity).toLocaleDateString('es-AR')}</span>
                    </div>
                    <div className="border-t border-border-primary pt-2 space-y-1">
                        <div className="flex justify-between gap-4 font-bold">
                            <span>Precio Finish:</span>
                            <span className="font-mono text-text-primary">{formatARS(data.redemptionValue)}</span>
                        </div>
                        <div className="flex justify-between gap-4 font-bold">
                            <span>Retorno Directo:</span>
                            <span className={`font-mono ${data.retornoDirecto >= 0 ? 'text-success' : 'text-danger'}`}>
                                {formatPercent(data.retornoDirecto / 100)}
                            </span>
                        </div>
                    </div>
                    <div className="border-t border-border-primary pt-2 space-y-1">
                        <div className="font-bold text-text-primary mb-1 text-center">Carry por Tipo de Cambio</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center">
                                <span className="text-text-tertiary">1000:</span>
                                <span className={`font-mono block ${getCarryColor(data.carry1000)}`}>{formatPercent(data.carry1000 / 100)}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-text-tertiary">1200:</span>
                                <span className={`font-mono block ${getCarryColor(data.carry1200)}`}>{formatPercent(data.carry1200 / 100)}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-text-tertiary">1400:</span>
                                <span className={`font-mono block ${getCarryColor(data.carry1400)}`}>{formatPercent(data.carry1400 / 100)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-border-primary pt-2">
                        <div className="flex justify-between gap-4">
                            <span className="text-text-tertiary">Banda Superior:</span>
                            <span className="font-mono text-text-tertiary">$ {data.bandaSuperior.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
                        </div>
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

    const getCarryColor = (carry) => {
        // Colores para heatmap de carry (en porcentaje)
        if (carry >= 5) return 'text-success bg-success/20'; // verde fuerte
        if (carry >= 2) return 'text-success/80 bg-success/10'; // verde medio
        if (carry >= 0) return 'text-success/60 bg-success/5'; // verde claro
        if (carry >= -2) return 'text-warning/80 bg-warning/10'; // amarillo
        if (carry >= -5) return 'text-danger/60 bg-danger/10'; // rojo claro
        return 'text-danger bg-danger/20'; // rojo fuerte
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

    if (!metrics || metrics.length === 0) {
        return (
            <div className="bg-background-secondary border border-border-primary rounded-xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <div className="p-3 bg-background-tertiary rounded-full mb-4">
                    <TrendingUp className="w-8 h-8 text-text-tertiary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">No se encontraron bonos para Carry Trade</h3>
                <p className="text-sm text-text-secondary max-w-md">
                    No se detectaron bonos del Tesoro (LETES/LECAPS) con precios válidos en la data actual.
                    <br /><br />
                    Los tickers buscados incluyen: T30E6, T13F6, S27F6, S17A6, S30A6, S29Y6, T30J6, S31G6, S30O6, S30N6, T15E7, T30A7, T31Y7
                </p>
                <div className="mt-4 text-xs font-mono text-text-tertiary bg-background-tertiary p-2 rounded">
                    Total Precios: {Object.keys(prices || {}).length} | MEP Rate: {mepRate}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-secondary border border-border-primary rounded-xl p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/20 rounded">
                        <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-text-primary">Carry Trade - Bonos del Tesoro</h3>
                        <p className="text-[10px] text-text-tertiary">Retorno total vs devaluación proyectada (inflación 1% mensual)</p>
                    </div>
                </div>
                <div className="flex text-xs gap-3">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-success"></div>
                        <span className="text-text-tertiary">Spread +</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-danger"></div>
                        <span className="text-text-tertiary">Spread -</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[160px]">
                {/* Tabla completa estilo Docta con columnas ordenadas */}
                <div className="overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-background-tertiary sticky top-0">
                            <tr>
                                <th className="text-left p-2 font-bold text-text-primary">Ticker</th>
                                <th className="text-right p-2 font-bold text-text-primary">Precio</th>
                                <th className="text-center p-2 font-bold text-text-primary">Días al vto.</th>
                                <th className="text-center p-2 font-bold text-text-primary">Fecha Vto.</th>
                                <th className="text-right p-2 font-bold text-text-primary">Precio Finish</th>
                                <th className="text-right p-2 font-bold text-text-primary">Retorno Directo</th>
                                <th className="text-center p-2 font-bold text-text-primary bg-warning/20">Carry 1000</th>
                                <th className="text-center p-2 font-bold text-text-primary bg-warning/20">Carry 1100</th>
                                <th className="text-center p-2 font-bold text-text-primary bg-warning/20">Carry 1200</th>
                                <th className="text-center p-2 font-bold text-text-primary bg-warning/20">Carry 1250</th>
                                <th className="text-center p-2 font-bold text-text-primary bg-warning/20">Carry 1300</th>
                                <th className="text-center p-2 font-bold text-text-primary bg-warning/20">Carry 1400</th>
                                <th className="text-right p-2 font-bold text-text-primary">Banda Superior</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, index) => (
                                <tr key={index} className="border-b border-border-primary/30 hover:bg-background-tertiary/50 transition-colors">
                                    <td className="p-2 font-mono font-bold text-text-primary">{item.name}</td>
                                    <td className="p-2 text-right font-mono text-text-secondary">
                                        {formatARS(item.marketPrice)}
                                    </td>
                                    <td className="p-2 text-center text-text-secondary">{item.daysToMaturity}</td>
                                    <td className="p-2 text-center text-text-secondary">
                                        {new Date(item.maturity).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                    </td>
                                    <td className="p-2 text-right font-mono text-text-secondary">
                                        {formatARS(item.redemptionValue)}
                                    </td>
                                    <td className={`p-2 text-right font-mono font-semibold ${item.retornoDirecto >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatPercent(item.retornoDirecto / 100)}
                                    </td>
                                    {/* Columnas de Carry con heatmap */}
                                    <td className={`p-2 text-center font-mono font-semibold ${getCarryColor(item.carry1000)}`}>
                                        {formatPercent(item.carry1000 / 100)}
                                    </td>
                                    <td className={`p-2 text-center font-mono font-semibold ${getCarryColor(item.carry1100)}`}>
                                        {formatPercent(item.carry1100 / 100)}
                                    </td>
                                    <td className={`p-2 text-center font-mono font-semibold ${getCarryColor(item.carry1200)}`}>
                                        {formatPercent(item.carry1200 / 100)}
                                    </td>
                                    <td className={`p-2 text-center font-mono font-semibold ${getCarryColor(item.carry1250)}`}>
                                        {formatPercent(item.carry1250 / 100)}
                                    </td>
                                    <td className={`p-2 text-center font-mono font-semibold ${getCarryColor(item.carry1300)}`}>
                                        {formatPercent(item.carry1300 / 100)}
                                    </td>
                                    <td className={`p-2 text-center font-mono font-semibold ${getCarryColor(item.carry1400)}`}>
                                        {formatPercent(item.carry1400 / 100)}
                                    </td>
                                    <td className="p-2 text-right font-mono text-text-tertiary">
                                        $ {item.bandaSuperior.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {data.length === 0 && (
                        <div className="text-center py-8 text-text-tertiary">
                            <p>No se encontraron bonos con precios válidos</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CarryTradeHeatmap;
