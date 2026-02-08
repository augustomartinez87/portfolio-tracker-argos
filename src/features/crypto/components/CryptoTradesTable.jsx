import React from 'react';
import { formatDateAR, formatUSDT, formatNumber } from '@/utils/formatters';

export const CryptoTradesTable = ({ trades = [], onEdit, onDelete }) => {
  return (
    <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-background-tertiary text-left text-xs font-bold text-text-tertiary uppercase">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary">
            {trades.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-text-tertiary">
                  Sin transacciones
                </td>
              </tr>
            ) : (
              trades.map((t) => {
                const qty = Math.abs(Number(t.quantity || 0));
                const total = qty * Number(t.price || 0);
                const isSell = String(t.trade_type || t.type).toLowerCase() === 'sell' || Number(t.quantity || 0) < 0;

                return (
                  <tr key={t.id} className="hover:bg-background-tertiary/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                      {formatDateAR(t.trade_date || t.date)}
                    </td>
                    <td className={`px-4 py-3 text-xs font-bold ${isSell ? 'text-loss' : 'text-profit'}`}>
                      {isSell ? 'VENTA' : 'COMPRA'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary font-medium">
                      {String(t.ticker || '').toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                      {formatNumber(qty, 6)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                      {formatUSDT(t.price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                      {formatUSDT(total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEdit(t)}
                          className="px-2.5 py-1.5 text-xs font-medium bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => onDelete(t)}
                          className="px-2.5 py-1.5 text-xs font-medium bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CryptoTradesTable;
