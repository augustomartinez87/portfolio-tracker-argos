import React, { memo, useState, useMemo, useEffect } from 'react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../../utils/formatters';
import { isBonoPesos, isBonoHardDollar } from '../../hooks/useBondPrices';
import { ArrowUp, ArrowDown } from 'lucide-react';
import ColumnSelector from './ColumnSelector';

const SORT_OPTIONS = [
  { key: 'ticker', label: 'Ticker', type: 'string' },
  { key: 'cantidadTotal', label: 'Cant.', type: 'number' },
  { key: 'precioPromedio', label: 'PPC', type: 'number', optional: true },
  { key: 'precioActual', label: 'P. Actual', type: 'number' },
  { key: 'costoTotal', label: 'Invertido', type: 'number', optional: true },
  { key: 'valuacionActual', label: 'Valuación', type: 'number' },
  { key: 'resultado', label: 'P&L $', type: 'number' },
  { key: 'resultadoPct', label: 'P&L %', type: 'number' },
  { key: 'resultadoDiario', label: 'P&L Diario $', type: 'number', optional: true },
  { key: 'resultadoDiarioPct', label: 'P&L Diario %', type: 'number', optional: true }
];

const COLUMN_DEFAULTS = {
  showPPC: true,
  showInvertido: true,
  showDiario: true,
  showDiarioPct: true,
  density: 'compact'
};

const loadColumnSettings = () => {
  try {
    const saved = localStorage.getItem('positionsTableSettings');
    if (saved) {
      return { ...COLUMN_DEFAULTS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Error loading column settings:', e);
  }
  return COLUMN_DEFAULTS;
};

const saveColumnSettings = (settings) => {
  try {
    localStorage.setItem('positionsTableSettings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Error saving column settings:', e);
  }
};

const SortHeader = ({ label, sortKey, currentSort, onSort }) => {
  const isActive = currentSort.key === sortKey;
  const isAsc = isActive && currentSort.direction === 'asc';
  const isDesc = isActive && currentSort.direction === 'desc';

  return (
    <th
      className={`text-right px-2 py-2 text-xs font-medium text-text-tertiary cursor-pointer select-none hover:text-text-primary transition-colors`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-end gap-1">
        <span>{label}</span>
        {isActive ? (
          isAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <span className="opacity-25">↓</span>
        )}
      </div>
    </th>
  );
};

const TickerCell = ({ ticker, assetClass, isStale }) => {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-text-primary font-mono text-base">{ticker}</span>
        {isStale && (
          <span className="text-[10px] text-amber-500" title="Precio desactualizado">!</span>
        )}
      </div>
      <span className="text-[11px] text-text-tertiary font-normal">{assetClass}</span>
    </div>
  );
};

const getAssetClassOrder = (assetClass) => {
  const order = {
    'BONOS PESOS': 1,
    'BONO HARD DOLLAR': 2,
    'CEDEAR': 3,
    'ARGY': 4,
    'OTROS': 5
  };
  return order[assetClass] || 5;
};

const PositionsTable = memo(({ positions, onRowClick, prices, mepRate, sortConfig, onSortChange, searchTerm, columnSettings, onColumnSettingsChange }) => {
  const defaultSort = { key: 'valuacionActual', direction: 'desc' };
  const currentSort = sortConfig || defaultSort;

  const handleSettingsChange = (newSettings) => {
    onColumnSettingsChange(newSettings);
    saveColumnSettings(newSettings);
  };

  const filteredPositions = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return positions;
    const term = searchTerm.toLowerCase();
    return positions.filter(pos =>
      pos.ticker.toLowerCase().includes(term) ||
      (pos.assetClass && pos.assetClass.toLowerCase().includes(term))
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
  }, [filteredPositions, currentSort]);

  const positionsWithGroup = useMemo(() => {
    const sorted = [...sortedPositions];
    return sorted.map((pos, index) => ({
      ...pos,
      groupOrder: getAssetClassOrder(pos.assetClass),
      isFirstInGroup: index === 0 || getAssetClassOrder(sorted[index - 1].assetClass) !== getAssetClassOrder(pos.assetClass)
    }));
  }, [sortedPositions]);

  const handleSort = (key) => {
    if (onSortChange) {
      if (currentSort.key === key) {
        onSortChange({
          key,
          direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
        });
      } else {
        const defaultDir = SORT_OPTIONS.find(o => o.key === key)?.type === 'string' ? 'asc' : 'desc';
        onSortChange({ key, direction: defaultDir });
      }
    }
  };

  const paddingY = columnSettings.density === 'compact' ? 'py-2' : 'py-2.5';
  const paddingX = 'px-3';

  const totalValuacion = positionsWithGroup.reduce((sum, p) => sum + p.valuacionActual, 0);
  const totalInvertido = positionsWithGroup.reduce((sum, p) => sum + p.costoTotal, 0);
  const totalResultado = positionsWithGroup.reduce((sum, p) => sum + p.resultado, 0);
  const totalResultadoPct = totalInvertido > 0 ? (totalResultado / totalInvertido) * 100 : 0;
  const totalDiario = positionsWithGroup.reduce((sum, p) => sum + (p.resultadoDiario || 0), 0);
  const totalDiarioPct = totalInvertido > 0 ? (totalDiario / totalInvertido) * 100 : 0;

  return (
    <div className="bg-background-secondary flex flex-col h-full overflow-hidden">
      {searchTerm && searchTerm.trim() && (
        <div className={`${paddingY} ${paddingX} bg-background-tertiary/50 border-b border-border-primary flex-shrink-0`}>
          <span className="text-xs text-text-tertiary">
            {filteredPositions.length} de {positions.length} resultados
          </span>
        </div>
      )}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full min-w-[900px]">
          <thead className="sticky top-0 z-10 bg-background-secondary">
            <tr className="bg-background-tertiary/30 border-b border-border-primary">
              <th
                className={`text-left ${paddingX} py-2 text-xs font-medium text-text-tertiary cursor-pointer select-none hover:text-text-primary transition-colors`}
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
              {columnSettings.showPPC && (
                <SortHeader label="PPC" sortKey="precioPromedio" currentSort={currentSort} onSort={handleSort} />
              )}
              <SortHeader label="P. Actual" sortKey="precioActual" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="Valuación" sortKey="valuacionActual" currentSort={currentSort} onSort={handleSort} />
              {columnSettings.showInvertido && (
                <SortHeader label="Invertido" sortKey="costoTotal" currentSort={currentSort} onSort={handleSort} />
              )}
              <SortHeader label="P&L $" sortKey="resultado" currentSort={currentSort} onSort={handleSort} />
              <SortHeader label="P&L %" sortKey="resultadoPct" currentSort={currentSort} onSort={handleSort} />
              {columnSettings.showDiario && (
                <SortHeader label="P&L Diario $" sortKey="resultadoDiario" currentSort={currentSort} onSort={handleSort} />
              )}
              {columnSettings.showDiarioPct && (
                <SortHeader label="P&L Diario %" sortKey="resultadoDiarioPct" currentSort={currentSort} onSort={handleSort} />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary">
            {positionsWithGroup.map((pos) => (
              <tr
                key={pos.ticker}
                className={`hover:bg-background-tertiary transition-colors cursor-pointer ${pos.isFirstInGroup ? 'border-t border-border-primary/50' : ''}`}
                onClick={() => onRowClick(pos)}
              >
                <td className={`${paddingX} ${paddingY}`}>
                  <TickerCell
                    ticker={pos.ticker}
                    assetClass={pos.assetClass}
                    isStale={prices[pos.ticker]?.isStale}
                  />
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-text-secondary font-mono text-xs font-normal tabular-nums`}>
                  {formatNumber(pos.cantidadTotal)}
                </td>
                {columnSettings.showPPC && (
                  <td className={`text-right ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs font-normal tabular-nums`}>
                    {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                      ? `$${pos.precioPromedio.toFixed(2)}`
                      : formatARS(pos.precioPromedio)
                    }
                  </td>
                )}
                <td className={`text-right ${paddingX} ${paddingY} text-text-primary font-mono font-medium text-sm tabular-nums`}>
                  {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                    ? `$${pos.precioActual.toFixed(2)}`
                    : formatARS(pos.precioActual)
                  }
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-text-primary font-mono text-base font-medium whitespace-nowrap tabular-nums`}>
                  {formatARS(pos.valuacionActual)}
                </td>
                {columnSettings.showInvertido && (
                  <td className={`text-right ${paddingX} ${paddingY} text-text-secondary font-mono text-xs font-normal tabular-nums`}>
                    {formatARS(pos.costoTotal)}
                  </td>
                )}
                <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                  <span className={`font-mono font-semibold text-base ${pos.resultado >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatARS(pos.resultado)}
                  </span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY}`}>
                  <span className={`font-medium px-1.5 py-0.5 rounded text-sm ${
                    pos.resultadoPct >= 0
                      ? 'bg-success/10 text-success'
                      : 'bg-danger/10 text-danger'
                  }`}>
                    {formatPercent(pos.resultadoPct)}
                  </span>
                </td>
                {columnSettings.showDiario && (
                  <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                    <span className={`font-mono text-sm font-medium ${pos.resultadoDiario >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(pos.resultadoDiario || 0)}
                    </span>
                  </td>
                )}
                {columnSettings.showDiarioPct && (
                  <td className={`text-right ${paddingX} ${paddingY}`}>
                    <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                      pos.resultadoDiarioPct >= 0
                        ? 'bg-success/10 text-success'
                        : 'bg-danger/10 text-danger'
                    }`}>
                      {formatPercent(pos.resultadoDiarioPct || 0)}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {positionsWithGroup.length > 0 && (
          <div className="flex-shrink-0 mt-2 mb-2 mx-2">
            <div className="flex items-center bg-background-secondary border border-border-primary rounded-lg p-4 shadow-md">
              <div className={`${paddingX} ${paddingY} text-text-primary pr-8 w-32`}>
                <span className="font-bold text-lg text-success">Total</span>
              </div>
              <div className={`${paddingX} ${paddingY} w-20`}></div>
              {columnSettings.showPPC && (
                <div className={`${paddingX} ${paddingY} w-24`}></div>
              )}
              <div className={`${paddingX} ${paddingY} w-24`}></div>
              <div className={`${paddingX} ${paddingY} flex-1 text-right text-text-primary font-mono font-bold text-lg tabular-nums`}>
                {formatARS(totalValuacion)}
              </div>
              {columnSettings.showInvertido && (
                <div className={`${paddingX} ${paddingY} w-32 text-right text-text-secondary font-mono font-medium tabular-nums`}>
                  {formatARS(totalInvertido)}
                </div>
              )}
              <div className={`${paddingX} ${paddingY} w-32 text-right tabular-nums`}>
                <span className={`font-mono font-bold text-lg ${totalResultado >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatARS(totalResultado)}
                </span>
              </div>
              <div className={`${paddingX} ${paddingY} w-24 text-right`}>
                <span className={`font-bold px-2 py-0.5 rounded text-sm ${totalResultadoPct >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {formatPercent(totalResultadoPct)}
                </span>
              </div>
              {columnSettings.showDiario && (
                <div className={`${paddingX} ${paddingY} w-28 text-right tabular-nums`}>
                  <span className={`font-mono text-sm font-medium ${totalDiario >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatARS(totalDiario)}
                  </span>
                </div>
              )}
              {columnSettings.showDiarioPct && (
                <div className={`${paddingX} ${paddingY} w-24 text-right`}>
                  <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${totalDiarioPct >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {formatPercent(totalDiarioPct)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {positionsWithGroup.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-secondary mb-1">No hay posiciones</p>
            <p className="text-text-tertiary text-xs">Importá tus trades o agregalos manualmente</p>
          </div>
        )}
      </div>
    </div>
  );
});

PositionsTable.displayName = 'PositionsTable';

export default PositionsTable;
