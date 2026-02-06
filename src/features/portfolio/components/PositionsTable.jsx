import React, { memo, useState, useMemo, useEffect } from 'react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '@/utils/formatters';
import { isBonoPesos, isBonoHardDollar } from '@/features/portfolio/hooks/useBondPrices';
import { ArrowUp, ArrowDown } from 'lucide-react';
import ColumnSelector from './ColumnSelector';
import { PercentageDisplay } from '@/components/common/PercentageDisplay';

const SORT_OPTIONS = [
  { key: 'ticker', label: 'Ticker', type: 'string' },
  { key: 'totalQuantity', label: 'Cant.', type: 'number' },
  { key: 'avgPrice', label: 'PPC', type: 'number', optional: true },
  { key: 'currentPrice', label: 'P. Actual', type: 'number' },
  { key: 'totalCost', label: 'Invertido', type: 'number', optional: true },
  { key: 'valuation', label: 'Valuación', type: 'number' },
  { key: 'result', label: 'P&L $', type: 'number' },
  { key: 'resultPct', label: 'P&L %', type: 'number' },
  { key: 'dailyResult', label: 'P&L Diario $', type: 'number', optional: true },
  { key: 'dailyResultPct', label: 'P&L Diario %', type: 'number', optional: true }
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
    // Ignore localStorage errors
  }
  return COLUMN_DEFAULTS;
};

const saveColumnSettings = (settings) => {
  try {
    localStorage.setItem('positionsTableSettings', JSON.stringify(settings));
  } catch (e) {
    // Ignore localStorage errors
  }
};

const SortHeader = ({ label, sortKey, currentSort, onSort }) => {
  const isActive = currentSort.key === sortKey;
  const isAsc = isActive && currentSort.direction === 'asc';

  return (
    <th
      className={`text-center px-2 py-2 text-xs font-medium text-text-tertiary cursor-pointer select-none hover:text-text-primary transition-colors`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-1">
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
          <span className="text-[10px] text-warning" title="Precio desactualizado">!</span>
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

const PositionsTable = memo(({ positions, onRowClick, prices, mepRate, sortConfig, onSortChange, searchTerm, columnSettings, onColumnSettingsChange, currency = 'ARS' }) => {
  const defaultSort = { key: 'valuation', direction: 'desc' };
  const currentSort = sortConfig || defaultSort;

  const handleSettingsChange = (newSettings) => {
    onColumnSettingsChange(newSettings);
    saveColumnSettings(newSettings);
  };

  /* 
    Filtered positions are now handled by the parent component (Dashboard.jsx)
    to enable dynamic calculation of totals.
    The 'positions' prop received here is already filtered.
  */
  const filteredPositions = positions;

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

  return (
    <div className="bg-background-secondary flex flex-col h-full overflow-hidden">
      {/* 
        Search result count removed here as it should be handled by the parent 
        if needed, or purely relying on the visual filtered list.
      */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[900px] table-fixed">
            <colgroup>
              <col className="w-[140px]" /> {/* Ticker */}
              <col className="w-[80px]" />  {/* Cant */}
              {columnSettings.showPPC && <col className="w-[100px]" />}  {/* PPC */}
              <col className="w-[100px]" /> {/* P. Actual */}
              <col className="w-[120px]" /> {/* Valuación */}
              {columnSettings.showInvertido && <col className="w-[110px]" />} {/* Invertido */}
              <col className="w-[120px]" /> {/* P&L $ */}
              <col className="w-[90px]" />  {/* P&L % */}
              {columnSettings.showDiario && <col className="w-[110px]" />} {/* Diario $ */}
              {columnSettings.showDiarioPct && <col className="w-[90px]" />} {/* Diario % */}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-background-secondary">
              <tr className="bg-background-tertiary border-b border-border-primary">
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
                <SortHeader label="Cant." sortKey="totalQuantity" currentSort={currentSort} onSort={handleSort} />
                {columnSettings.showPPC && (
                  <SortHeader label="PPC" sortKey="avgPrice" currentSort={currentSort} onSort={handleSort} />
                )}
                <SortHeader label="P. Actual" sortKey="currentPrice" currentSort={currentSort} onSort={handleSort} />
                <SortHeader label="Valuación" sortKey="valuation" currentSort={currentSort} onSort={handleSort} />
                {columnSettings.showInvertido && (
                  <SortHeader label="Invertido" sortKey="totalCost" currentSort={currentSort} onSort={handleSort} />
                )}
                <SortHeader label="P&L $" sortKey="result" currentSort={currentSort} onSort={handleSort} />
                <SortHeader label="P&L %" sortKey="resultPct" currentSort={currentSort} onSort={handleSort} />
                {columnSettings.showDiario && (
                  <SortHeader label="P&L Diario $" sortKey="dailyResult" currentSort={currentSort} onSort={handleSort} />
                )}
                {columnSettings.showDiarioPct && (
                  <SortHeader label="P&L Diario %" sortKey="dailyResultPct" currentSort={currentSort} onSort={handleSort} />
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
                  <td className={`text-center ${paddingX} ${paddingY} text-text-secondary font-mono text-xs font-normal tabular-nums`}>
                    {formatNumber(pos.totalQuantity)}
                  </td>
                  {columnSettings.showPPC && (
                    <td className={`text-center ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs font-normal tabular-nums`}>
                      {currency === 'ARS'
                        ? ((isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker)) ? `$${pos.avgPrice.toFixed(2)}` : formatARS(pos.avgPrice))
                        : formatUSD(pos.costUSD / pos.totalQuantity)
                      }
                    </td>
                  )}
                  <td className={`text-center ${paddingX} ${paddingY} text-text-primary font-mono font-medium text-sm tabular-nums`}>
                    {currency === 'ARS'
                      ? ((isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker)) ? `$${pos.currentPrice.toFixed(2)}` : formatARS(pos.currentPrice))
                      : formatUSD(pos.valuationUSD / pos.totalQuantity)
                    }
                  </td>
                  <td className={`text-center ${paddingX} ${paddingY} text-text-primary font-mono text-base font-medium whitespace-nowrap tabular-nums`}>
                    {currency === 'ARS' ? formatARS(pos.valuation) : formatUSD(pos.valuationUSD)}
                  </td>
                  {columnSettings.showInvertido && (
                    <td className={`text-center ${paddingX} ${paddingY} text-text-secondary font-mono text-xs font-normal tabular-nums`}>
                      {currency === 'ARS' ? formatARS(pos.totalCost) : formatUSD(pos.costUSD)}
                    </td>
                  )}
                  <td className={`text-center ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                    <span className={`font-mono font-semibold text-base ${pos.result >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {currency === 'ARS' ? formatARS(pos.result) : formatUSD(pos.resultUSD)}
                    </span>
                  </td>
                  <td className={`text-center ${paddingX} ${paddingY}`}>
                    <span className={`font-medium px-1.5 py-0.5 rounded text-sm inline-block ${(currency === 'ARS' ? pos.resultPct : pos.resultPctUSD) >= 0
                      ? 'bg-profit-muted text-profit'
                      : 'bg-loss-muted text-loss'
                      }`}>
                      <PercentageDisplay value={currency === 'ARS' ? pos.resultPct : pos.resultPctUSD} className="!text-current" iconSize="w-3 h-3" />
                    </span>
                  </td>
                  {columnSettings.showDiario && (
                    <td className={`text-center ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                      <span className={`font-mono text-sm font-medium ${pos.dailyResult >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {currency === 'ARS' ? formatARS(pos.dailyResult || 0) : formatUSD(pos.dailyResultUSD || 0)}
                      </span>
                    </td>
                  )}
                  {columnSettings.showDiarioPct && (
                    <td className={`text-center ${paddingX} ${paddingY}`}>
                      <span className={`font-medium px-1.5 py-0.5 rounded text-xs inline-block ${(currency === 'ARS' ? pos.dailyResultPct : pos.dailyResultPctUSD) >= 0
                        ? 'bg-profit-muted text-profit'
                        : 'bg-loss-muted text-loss'
                        }`}>
                        <PercentageDisplay value={currency === 'ARS' ? pos.dailyResultPct : pos.dailyResultPctUSD} className="!text-current" iconSize="w-3 h-3" />
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
