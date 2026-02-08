import React from 'react';
import { formatNumber, formatPercent, formatUSDT } from '@/utils/formatters';

export const CryptoPositionsTable = ({ positions = [], onRowClick }) => {
  return (
    <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-background-tertiary text-left text-xs font-bold text-text-tertiary uppercase">
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">PPC</th>
              <th className="px-4 py-3">P actual</th>
              <th className="px-4 py-3">Valuacion</th>
              <th className="px-4 py-3">Costo</th>
              <th className="px-4 py-3">P&L $</th>
              <th className="px-4 py-3">P&L %</th>
              <th className="px-4 py-3">P&L diario $</th>
              <th className="px-4 py-3">P&L diario %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary">
            {positions.length === 0 ? (
              <tr>
                <td colSpan="10" className="px-4 py-6 text-center text-text-tertiary">
                  Sin posiciones
                </td>
              </tr>
            ) : (
              positions.map((p) => (
                <tr
                  key={p.assetId}
                  className="hover:bg-background-tertiary/50 transition-colors cursor-pointer"
                  onClick={() => onRowClick && onRowClick(p)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">
                      {p.symbol || String(p.assetId).toUpperCase()}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {p.name || 'Desconocido'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                    {formatNumber(p.quantity, 6)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                    {formatUSDT(p.avgPrice)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                    {formatUSDT(p.currentPrice)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                    {formatUSDT(p.valuation)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-tertiary font-mono">
                    {formatUSDT(p.totalCost)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-mono ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatUSDT(p.pnl)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-mono ${p.pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatPercent(p.pnlPct)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-mono ${p.dailyPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatUSDT(p.dailyPnl)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-mono ${p.dailyPnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {p.dailyPnlPct === null ? '-' : formatPercent(p.dailyPnlPct)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CryptoPositionsTable;
