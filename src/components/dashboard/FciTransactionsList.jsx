import React from 'react';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { formatARS, formatNumber } from '../../utils/formatters';

const FciTransactionsList = ({ transactions, onDelete }) => {
    if (!transactions || transactions.length === 0) {
        return (
            <div className="p-8 text-center text-text-tertiary">
                <p>No hay historial de transacciones para este portfolio.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
                <thead>
                    <tr className="bg-background-tertiary text-left text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Fondo</th>
                        <th className="px-4 py-3 text-center">Tipo</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-right">VCP</th>
                        <th className="px-4 py-3 text-right">Cuotapartes</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                    {transactions.map((tx) => {
                        const isSub = tx.tipo === 'SUBSCRIPTION';
                        return (
                            <tr key={tx.id} className="hover:bg-background-tertiary transition-all duration-200">
                                <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap font-mono">
                                    {new Date(tx.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                                </td>
                                <td className="px-4 py-3 text-sm font-bold text-text-primary">
                                    {tx.fci_master?.nombre || 'FCI'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${isSub
                                            ? 'bg-profit/10 text-profit border border-profit/20'
                                            : 'bg-loss/10 text-loss border border-loss/20'
                                        }`}>
                                        {isSub ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {isSub ? 'Suscripción' : 'Rescate'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono font-bold text-text-primary">
                                    {formatARS(tx.monto)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono text-text-tertiary tabular-nums">
                                    {formatNumber(tx.vcp_operado, 6)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary tabular-nums">
                                    {formatNumber(tx.cuotapartes, 6)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => {
                                            if (window.confirm('¿Estás seguro de eliminar esta transacción? Esto recalculará tus saldos y carry trade.')) {
                                                onDelete(tx.id);
                                            }
                                        }}
                                        className="p-1.5 text-text-tertiary hover:text-loss hover:bg-loss/10 rounded-lg transition-all"
                                        title="Eliminar transaccion"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default FciTransactionsList;
