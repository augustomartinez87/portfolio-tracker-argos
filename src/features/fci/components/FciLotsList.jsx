import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatARS, formatUSD, formatNumber } from '@/utils/formatters';
import { mepService } from '../../portfolio/services/mepService';
import { useMemo } from 'react';

const FciLotsList = ({ allLots, onDelete, currency = 'ARS', mepHistory = [] }) => {
    const mepMap = useMemo(() => mepService.buildMepMap(mepHistory), [mepHistory]);

    if (!allLots || allLots.length === 0) {
        return (
            <div className="p-8 text-center text-text-tertiary">
                <p>No hay historial de lotes para este portfolio.</p>
            </div>
        );
    }

    const formatVal = (lot, arsVal) => {
        if (currency === 'ARS') return formatARS(arsVal);
        const rate = mepService.findClosestRate(lot.fecha_suscripcion, mepMap);
        return formatUSD(rate > 0 ? arsVal / rate : 0);
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
                <thead>
                    <tr className="bg-background-tertiary text-left text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Fondo</th>
                        <th className="px-4 py-3">Lugar</th>
                        <th className="px-4 py-3 text-right">VCP Entrada</th>
                        <th className="px-4 py-3 text-right">Cuotapartes</th>
                        <th className="px-4 py-3 text-right">Capital</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                    {allLots.map((lot) => {
                        const vcpDisplay = currency === 'ARS'
                            ? lot.vcp_entrada
                            : (lot.vcp_entrada / (mepService.findClosestRate(lot.fecha_suscripcion, mepMap) || 1));

                        return (
                            <tr key={lot.id} className={`hover:bg-background-tertiary transition-all duration-200 ${!lot.activo ? 'opacity-60' : ''}`}>
                                <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap font-mono">
                                    {new Date(lot.fecha_suscripcion + 'T00:00:00').toLocaleDateString('es-AR')}
                                </td>
                                <td className="px-4 py-3 text-sm font-bold text-text-primary">
                                    {lot.fci_master?.nombre || 'FCI'}
                                </td>
                                <td className="px-4 py-3 text-sm text-text-secondary">
                                    {lot.lugares?.nombre || <span className="text-text-tertiary italic text-xs">Sin lugar</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono text-text-tertiary tabular-nums">
                                    {currency === 'ARS' ? formatNumber(vcpDisplay, 6) : `u$s ${vcpDisplay.toFixed(6)}`}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary tabular-nums">
                                    {formatNumber(lot.cuotapartes, 2)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono font-bold text-text-primary">
                                    {formatVal(lot, Number(lot.capital_invertido))}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${lot.activo
                                        ? 'bg-profit/10 text-profit border border-profit/20'
                                        : 'bg-background-tertiary text-text-tertiary border border-border-primary'
                                    }`}>
                                        {lot.activo ? 'Activo' : 'Agotado'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {lot.activo && (
                                        <button
                                            onClick={() => onDelete(lot.id)}
                                            className="p-1.5 text-text-tertiary hover:text-loss hover:bg-loss/10 rounded-lg transition-all"
                                            title="Eliminar lote"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default FciLotsList;
