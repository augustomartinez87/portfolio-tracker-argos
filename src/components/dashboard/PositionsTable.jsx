// src/components/dashboard/PositionsTable.jsx
import React, { memo } from 'react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../../utils/formatters';
import { isBonoPesos, isBonoHardDollar } from '../../hooks/useBondPrices';

const PositionsTable = memo(({ positions, onRowClick, prices, mepRate }) => {
  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Posiciones</h3>
        <span className="text-sm text-slate-400">{positions.length} activos</span>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticker</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Cant.</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">P. Prom.</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">P. Actual</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Invertido</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valuación</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden xl:table-cell">Result. Total</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Result. Diario</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">% Diario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {positions.map((pos) => (
              <React.Fragment key={pos.ticker}>
                <tr
                  className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                  onClick={() => onRowClick(pos)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white font-mono">{pos.ticker}</span>
                        {pos.pctChange !== null && pos.pctChange !== undefined && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            pos.pctChange >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {pos.pctChange >= 0 ? '+' : ''}{pos.pctChange.toFixed(2)}%
                          </span>
                        )}
                        {prices[pos.ticker]?.isStale && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 ml-1">
                            ⚠️
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{pos.assetClass}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 text-slate-300 font-mono hidden sm:table-cell">
                    {formatNumber(pos.cantidadTotal)}
                  </td>
                  <td className="text-right px-4 py-3 text-slate-400 font-mono text-sm hidden md:table-cell">
                    {isBonoPesos(pos.ticker) 
                      ? `$${pos.precioPromedio.toFixed(4)}` 
                      : isBonoHardDollar(pos.ticker)
                        ? `$${((pos.precioPromedio / 100) * mepRate).toFixed(2)}`
                        : formatARS(pos.precioPromedio)
                    }
                  </td>
                  <td className="text-right px-4 py-3 text-white font-mono font-medium">
                    {isBonoPesos(pos.ticker) 
                      ? `$${pos.precioActual.toFixed(4)}` 
                      : isBonoHardDollar(pos.ticker)
                        ? `$${((pos.precioActual / 100) * mepRate).toFixed(2)}`
                        : formatARS(pos.precioActual)
                    }
                  </td>
                  <td className="text-right px-4 py-3 text-slate-400 font-mono text-sm hidden lg:table-cell">
                    {pos.isBonoHD 
                      ? formatUSD(pos.costoTotal)
                      : formatARS(pos.costoTotal)
                    }
                  </td>
                  <td className="text-right px-4 py-3 text-white font-mono font-medium">
                    {pos.isBonoHD 
                      ? formatUSD(pos.valuacionActual)
                      : formatARS(pos.valuacionActual)
                    }
                  </td>
                  <td className="text-right px-4 py-3 hidden xl:table-cell">
                    <div className={`font-mono font-medium ${pos.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatARS(pos.resultado)}
                      <span className="block text-xs opacity-80">
                        {formatPercent(pos.resultadoPct)}
                      </span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3">
                    <div className={`font-mpos.resultadoDiono font-medium ${ario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatARS(pos.resultadoDiario || 0)}
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      pos.resultadoDiarioPct >= 0 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {formatPercent(pos.resultadoDiarioPct || 0)}
                    </span>
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {positions.length > 0 && (
              <tr className="bg-slate-900/80 border-t-2 border-emerald-500/30">
                <td className="px-4 py-4 text-left">
                  <span className="font-bold text-emerald-400 uppercase tracking-wide text-sm">TOTAL PORTFOLIO</span>
                </td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden sm:table-cell">-</td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden md:table-cell">-</td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm">-</td>
                <td className="text-right px-4 py-4 text-white font-mono font-bold text-base hidden lg:table-cell">
                  {formatARS(positions.reduce((sum, p) => sum + p.costoTotal, 0))}
                </td>
                <td className="text-right px-4 py-4 text-white font-mono font-bold text-base">
                  {formatARS(positions.reduce((sum, p) => sum + p.valuacionActual, 0))}
                </td>
                <td className="text-right px-4 py-4 hidden xl:table-cell">
                  {(() => {
                    const totalResult = positions.reduce((sum, p) => sum + p.resultado, 0);
                    const totalResultPct = positions.reduce((sum, p) => sum + p.costoTotal, 0) > 0 
                      ? (totalResult / positions.reduce((sum, p) => sum + p.costoTotal, 0)) * 100 
                      : 0;
                    return (
                      <div className={`font-mono font-bold text-base ${totalResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatARS(totalResult)}
                        <span className="block text-xs opacity-90 font-semibold">
                          {formatPercent(totalResultPct)}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="text-right px-4 py-4">
                  {(() => {
                    const totalDiario = positions.reduce((sum, p) => sum + (p.resultadoDiario || 0), 0);
                    return (
                      <div className={`font-mono font-bold text-base ${totalDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatARS(totalDiario)}
                      </div>
                    );
                  })()}
                </td>
                <td className="text-right px-4 py-4 hidden lg:table-cell">
                  {(() => {
                    const totalDiarioPct = positions.reduce((sum, p) => sum + p.valuacionActual, 0) > 0 
                      ? (positions.reduce((sum, p) => sum + (p.resultadoDiario || 0), 0) / positions.reduce((sum, p) => sum + p.valuacionActual, 0)) * 100 
                      : 0;
                    return (
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        totalDiarioPct >= 0 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {formatPercent(totalDiarioPct)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {positions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-2">No hay posiciones</p>
            <p className="text-slate-500 text-sm">Importá tus trades desde Google Sheets o agregalos manualmente</p>
          </div>
        )}
      </div>
    </div>
  );
});

PositionsTable.displayName = 'PositionsTable';

export default PositionsTable;
