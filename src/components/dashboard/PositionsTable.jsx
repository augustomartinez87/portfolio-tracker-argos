// src/components/dashboard/PositionsTable.jsx
import React, { memo, useState, useMemo } from 'react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../../utils/formatters';
import { isBonoPesos, isBonoHardDollar } from '../../hooks/useBondPrices';
import { ArrowUp, ArrowDown } from 'lucide-react';

const SORT_OPTIONS = [
  { key: 'ticker', label: 'Ticker', type: 'string' },
  { key: 'cantidadTotal', label: 'Cant.', type: 'number' },
  { key: 'precioPromedio', label: 'P. Prom.', type: 'number' },
  { key: 'precioActual', label: 'P. Actual', type: 'number' },
  { key: 'costoTotal', label: 'Invertido', type: 'number' },
  { key: 'valuacionActual', label: 'Valuación', type: 'number' },
  { key: 'resultado', label: 'Result. Total', type: 'number' },
  { key: 'resultadoDiario', label: 'Result. Diario', type: 'number' },
  { key: 'resultadoDiarioPct', label: '% Diario', type: 'number' }
];

const SortHeader = ({ label, sortKey, currentSort, onSort }) => {
  const isActive = currentSort.key === sortKey;
  const isAsc = isActive && currentSort.direction === 'asc';
  const isDesc = isActive && currentSort.direction === 'desc';

  return (
    <th 
      className={`text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${
        isActive ? 'text-emerald-400' : 'text-slate-400'
      }`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-end gap-1">
        <span>{label}</span>
        {isActive && (
          isAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
        {!isActive && <span className="opacity-30">↕</span>}
      </div>
    </th>
  );
};

const PositionsTable = memo(({ positions, onRowClick, prices, mepRate, sortConfig, onSortChange }) => {
  const defaultSort = { key: 'valuacionActual', direction: 'desc' };
  const currentSort = sortConfig || defaultSort;

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      let aVal = a[currentSort.key];
      let bVal = b[currentSort.key];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [positions, currentSort]);

  const handleSort = (key) => {
    if (onSortChange) {
      if (currentSort.key === key) {
        onSortChange({ 
          key, 
          direction: currentSort.direction === 'asc' ? 'desc' : 'asc' 
        });
      } else {
        // Default to descending for most columns, ascending for strings
        const defaultDir = SORT_OPTIONS.find(o => o.key === key)?.type === 'string' ? 'asc' : 'desc';
        onSortChange({ key, direction: defaultDir });
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Posiciones</h3>
        <span className="text-sm text-slate-400">{positions.length} activos</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="bg-slate-900/50">
              <th 
                className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${
                  currentSort.key === 'ticker' ? 'text-emerald-400' : 'text-slate-400'
                }`}
                onClick={() => handleSort('ticker')}
              >
                <div className="flex items-center gap-1">
                  <span>Ticker</span>
                  {currentSort.key === 'ticker' && (
                    currentSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </div>
              </th>
              <SortHeader label="Cant." sortKey="cantidadTotal" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P. Prom." sortKey="precioPromedio" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P. Actual" sortKey="precioActual" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="Invertido" sortKey="costoTotal" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="Valuación" sortKey="valuacionActual" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="Result. Total" sortKey="resultado" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="Result. Diario" sortKey="resultadoDiario" currentSort={currentSort} onSort={handleSort} />
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                % Diario
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sortedPositions.map((pos) => (
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
                    <div className={`font-mono font-medium ${pos.resultadoDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
            {sortedPositions.length > 0 && (
              <tr className="bg-slate-900/80 border-t-2 border-emerald-500/30">
                <td className="px-4 py-4 text-left">
                  <span className="font-bold text-emerald-400 uppercase tracking-wide text-sm">TOTAL PORTFOLIO</span>
                </td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden sm:table-cell">-</td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden md:table-cell">-</td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm">-</td>
                <td className="text-right px-4 py-4 text-white font-mono font-bold text-base hidden lg:table-cell">
                  {formatUSD(sortedPositions.reduce((sum, p) => sum + p.costoUSD, 0))}
                </td>
                <td className="text-right px-4 py-4 text-white font-mono font-bold text-base">
                  {formatUSD(sortedPositions.reduce((sum, p) => sum + p.valuacionUSD, 0))}
                </td>
                <td className="text-right px-4 py-4 hidden xl:table-cell">
                  {(() => {
                    const totalResult = sortedPositions.reduce((sum, p) => sum + p.resultadoUSD, 0);
                    const totalInvertido = sortedPositions.reduce((sum, p) => sum + p.costoUSD, 0);
                    const totalResultPct = totalInvertido > 0 ? (totalResult / totalInvertido) * 100 : 0;
                    return (
                      <div className={`font-mono font-bold text-base ${totalResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatUSD(totalResult)}
                        <span className="block text-xs opacity-90 font-semibold">
                          {formatPercent(totalResultPct)}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="text-right px-4 py-4">
                  {(() => {
                    const totalDiario = sortedPositions.reduce((sum, p) => sum + p.resultadoDiarioUSD, 0);
                    return (
                      <div className={`font-mono font-bold text-base ${totalDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatUSD(totalDiario)}
                      </div>
                    );
                  })()}
                </td>
                <td className="text-right px-4 py-4 hidden lg:table-cell">
                  {(() => {
                    const totalValuation = sortedPositions.reduce((sum, p) => sum + p.valuacionUSD, 0);
                    const totalDiario = sortedPositions.reduce((sum, p) => sum + p.resultadoDiarioUSD, 0);
                    const totalDiarioPct = totalValuation > 0 ? (totalDiario / totalValuation) * 100 : 0;
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
        {sortedPositions.length === 0 && (
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
