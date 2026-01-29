import React from 'react';
import { ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '@/utils/formatters';

const FciTable = ({ positions, onSubscribe, onRedeem, currency = 'ARS', mepRate = 1 }) => {
    if (!positions || positions.length === 0) {
        return (
            <div className="p-8 text-center text-text-tertiary">
                <p>No tienes tenencias en Fondos Comunes de Inversión.</p>
            </div>
        );
    }

    const formatVal = (arsVal, usdVal) => currency === 'ARS' ? formatARS(arsVal) : formatUSD(usdVal);

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
                <thead>
                    <tr className="bg-background-tertiary text-left text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                        <th className="px-4 py-2 cursor-pointer hover:text-text-primary transition-colors">Fondo</th>
                        <th className="px-4 py-2 text-right cursor-pointer hover:text-text-primary transition-colors">Cuotapartes</th>
                        <th className="px-4 py-2 text-right cursor-pointer hover:text-text-primary transition-colors">VCP Actual</th>
                        <th className="px-4 py-2 text-right cursor-pointer hover:text-text-primary transition-colors">Valuación</th>
                        <th className="px-4 py-2 text-right cursor-pointer hover:text-text-primary transition-colors">Invertido</th>
                        <th className="px-4 py-2 text-right cursor-pointer hover:text-text-primary transition-colors">Resultado</th>
                        <th className="px-4 py-2 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                    {positions.map((pos) => {
                        const isPositive = pos.pnl >= 0;
                        const vcpDisplay = currency === 'ARS' ? pos.ultimoVcp : (pos.ultimoVcp / mepRate);

                        return (
                            <tr key={pos.fciId} className="hover:bg-background-tertiary transition-all duration-200 group">
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-text-primary text-sm">{pos.nombre}</span>
                                        <span className="text-[10px] text-text-tertiary">
                                            {pos.fechaPrecios ? `VCP al ${new Date(pos.fechaPrecios + 'T00:00:00').toLocaleDateString('es-AR')}` : 'Sin precio'}
                                        </span>
                                    </div>
                                </td>

                                <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                                    {formatNumber(pos.cuotapartes, 2)}
                                </td>

                                <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                                    {currency === 'ARS' ? formatNumber(vcpDisplay, 6) : `u$s ${vcpDisplay.toFixed(6)}`}
                                </td>

                                <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">
                                    {formatVal(pos.valuacion, pos.valuacionUSD)}
                                </td>

                                <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                                    {formatVal(pos.montoInvertido, pos.montoInvertidoUSD)}
                                </td>

                                <td className="px-4 py-3 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className={`text-sm font-mono font-bold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                                            {formatVal(pos.pnl, pos.pnlUSD)}
                                        </span>
                                        <span className={`text-xs font-mono flex items-center ${isPositive ? 'text-profit' : 'text-loss'}`}>
                                            {isPositive ? <ChevronUp className="w-3 h-3 mr-0.5" /> : <ChevronDown className="w-3 h-3 mr-0.5" />}
                                            {formatPercent(pos.pnlPct)}
                                        </span>
                                    </div>
                                </td>

                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onSubscribe(pos)}
                                            className="p-1.5 rounded-lg bg-background-tertiary text-profit hover:bg-profit/20 border border-profit/30 transition-colors"
                                            title="Suscribir"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onRedeem(pos)}
                                            className="p-1.5 rounded-lg bg-background-tertiary text-loss hover:bg-loss/20 border border-loss/30 transition-colors"
                                            title="Rescatar"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default FciTable;
