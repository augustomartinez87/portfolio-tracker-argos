// src/components/dashboard/PositionsTable.jsx
import React, { memo, useState, useMemo } from 'react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../../utils/formatters';
import { isBonoPesos, isBonoHardDollar } from '../../hooks/useBondPrices';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const defaultSort = { key: 'valuacionActual', direction: 'desc' };
  const currentSort = sortConfig || defaultSort;

  const filteredPositions = useMemo(() => {
    if (!searchTerm.trim()) return positions;
    const term = searchTerm.toLowerCase();
    return positions.filter(pos =>
      pos.ticker.toLowerCase().includes(term) ||
      pos.assetClass.toLowerCase().includes(term)
    );
  }, [positions, searchTerm]);

  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
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
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-custom border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h3 className="text-lg font-semibold text-white">Posiciones</h3>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar ticker o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-custom text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
          />
        </div>
      </div>
      {searchTerm && (
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
          <span className="text-sm text-slate-400">
            {filteredPositions.length} de {positions.length} resultados
          </span>
        </div>
      )}
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
              <SortHeader label="PPC" sortKey="precioPromedio" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P. Actual" sortKey="precioActual" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="Invertido" sortKey="costoTotal" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="Valuación" sortKey="valuacionActual" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P&L $" sortKey="resultado" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P&L %" sortKey="resultadoPct" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P&L Diario $" sortKey="resultadoDiario" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P&L Diario %" sortKey="resultadoDiarioPct" currentSort={currentSort} onSort={handleSort} />
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
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-custom ${
                            pos.pctChange >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                          }`}>
                            {pos.pctChange >= 0 ? '+' : ''}{pos.pctChange.toFixed(2)}%
                          </span>
                        )}
                        {prices[pos.ticker]?.isStale && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded-custom bg-amber-500/20 text-amber-400 ml-1">
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
                    {/* Precios ya vienen ajustados desde Dashboard, no dividir de nuevo */}
                    {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                      ? `$${pos.precioPromedio.toFixed(2)}`
                      : formatARS(pos.precioPromedio)
                    }
                  </td>
                  <td className="text-right px-4 py-3 text-white font-mono font-medium">
                    {/* Precios ya vienen ajustados desde Dashboard, no dividir de nuevo */}
                    {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                      ? `$${pos.precioActual.toFixed(2)}`
                      : formatARS(pos.precioActual)
                    }
                  </td>
                  <td className="text-right px-4 py-3 text-slate-400 font-mono text-xs hidden lg:table-cell whitespace-nowrap">
                    {formatARS(pos.costoTotal)}
                  </td>
                  <td className="text-right px-4 py-3 text-white font-mono text-sm whitespace-nowrap">
                    {formatARS(pos.valuacionActual)}
                  </td>
                  <td className="text-right px-4 py-3 whitespace-nowrap">
                    <span className={`font-mono text-sm ${pos.resultado >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(pos.resultado)}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 hidden sm:table-cell">
                    <span className={`text-sm font-medium px-1.5 py-0.5 rounded-custom ${
                      pos.resultadoPct >= 0 
                        ? 'bg-success/20 text-success' 
                        : 'bg-danger/20 text-danger'
                    }`}>
                      {formatPercent(pos.resultadoPct)}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 whitespace-nowrap">
                    <span className={`font-mono text-sm ${pos.resultadoDiario >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(pos.resultadoDiario || 0)}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 hidden sm:table-cell">
                    <span className={`text-sm font-medium px-1.5 py-0.5 rounded-custom ${
                      pos.resultadoDiarioPct >= 0 
                        ? 'bg-success/20 text-success' 
                        : 'bg-danger/20 text-danger'
                    }`}>
                      {formatPercent(pos.resultadoDiarioPct || 0)}
                    </span>
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {sortedPositions.length > 0 && (
              <tr className="bg-gradient-to-r from-primary/10 via-slate-800/90 to-primary/10 border-t-2 border-primary/40">
                <td className="px-4 py-4 text-left">
                  <span className="font-bold text-primary uppercase tracking-wider text-sm flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    TOTAL PORTFOLIO
                  </span>
                </td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden sm:table-cell">-</td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden md:table-cell">-</td>
                <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm">-</td>
                <td className="text-right px-4 py-4 text-white font-mono font-bold text-xs hidden lg:table-cell whitespace-nowrap">
                  {formatUSD(sortedPositions.reduce((sum, p) => sum + p.costoUSD, 0))}
                </td>
                <td className="text-right px-4 py-4 text-white font-mono font-bold text-sm whitespace-nowrap">
                  {formatUSD(sortedPositions.reduce((sum, p) => sum + p.valuacionUSD, 0))}
                </td>
                <td className="text-right px-4 py-4 whitespace-nowrap">
                  {(() => {
                    const totalResult = sortedPositions.reduce((sum, p) => sum + p.resultado, 0);
                    return (
                      <span className={`font-mono font-bold ${totalResult >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatARS(totalResult)}
                      </span>
                    );
                  })()}
                </td>
                <td className="text-right px-4 py-4 hidden sm:table-cell">
                  {(() => {
                    const totalResult = sortedPositions.reduce((sum, p) => sum + p.resultado, 0);
                    const totalInvertido = sortedPositions.reduce((sum, p) => sum + p.costoTotal, 0);
                    const totalResultPct = totalInvertido > 0 ? (totalResult / totalInvertido) * 100 : 0;
                    return (
                      <span className={`font-bold text-sm px-2 py-0.5 rounded-lg ${
                        totalResultPct >= 0 
                          ? 'bg-success/20 text-success border border-success/30' 
                          : 'bg-danger/20 text-danger border border-danger/30'
                      }`}>
                        {formatPercent(totalResultPct)}
                      </span>
                    );
                  })()}
                </td>
                <td className="text-right px-4 py-4 whitespace-nowrap">
                  {(() => {
                    const totalDiario = sortedPositions.reduce((sum, p) => sum + p.resultadoDiario, 0);
                    return (
                      <span className={`font-mono font-bold ${totalDiario >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatARS(totalDiario)}
                      </span>
                    );
                  })()}
                </td>
                <td className="text-right px-4 py-4 hidden sm:table-cell">
                  {(() => {
                    const totalValuation = sortedPositions.reduce((sum, p) => sum + p.valuacionActual, 0);
                    const totalDiario = sortedPositions.reduce((sum, p) => sum + p.resultadoDiario, 0);
                    const totalDiarioPct = totalValuation > 0 ? (totalDiario / totalValuation) * 100 : 0;
                    return (
                      <span className={`font-bold text-sm px-2 py-0.5 rounded-lg ${
                        totalDiarioPct >= 0 
                          ? 'bg-success/20 text-success border border-success/30' 
                          : 'bg-danger/20 text-danger border border-danger/30'
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
