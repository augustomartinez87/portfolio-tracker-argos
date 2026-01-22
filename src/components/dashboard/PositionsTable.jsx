import React, { memo, useState, useMemo, useEffect } from 'react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../../utils/formatters';
import { isBonoPesos, isBonoHardDollar } from '../../hooks/useBondPrices';
import { ArrowUp, ArrowDown, Search, Columns, Minimize2, Maximize2 } from 'lucide-react';

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
      className={`text-right px-3 py-2 text-[10px] font-medium text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors`}
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

const ColumnToggle = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700/50 rounded cursor-pointer transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
    />
    <span className="text-sm text-slate-300">{label}</span>
  </label>
);

const ColumnSelector = ({ settings, onSettingsChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
        title="Personalizar columnas"
      >
        <Columns className="w-4 h-4" />
        <span>Columnas</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-3 min-w-[200px]">
            <p className="text-xs text-slate-400 px-2 pb-2 mb-2 border-b border-slate-700">Mostrar/Ocultar columnas</p>
            <ColumnToggle
              label="PPC"
              checked={settings.showPPC}
              onChange={(v) => onSettingsChange({ ...settings, showPPC: v })}
            />
            <ColumnToggle
              label="Invertido"
              checked={settings.showInvertido}
              onChange={(v) => onSettingsChange({ ...settings, showInvertido: v })}
            />
            <ColumnToggle
              label="P&L Diario $"
              checked={settings.showDiario}
              onChange={(v) => onSettingsChange({ ...settings, showDiario: v })}
            />
            <ColumnToggle
              label="P&L Diario %"
              checked={settings.showDiarioPct}
              onChange={(v) => onSettingsChange({ ...settings, showDiarioPct: v })}
            />
            <div className="border-t border-slate-700 mt-2 pt-2">
              <p className="text-xs text-slate-400 px-2 pb-2">Densidad</p>
              <div className="flex gap-1 px-2">
                <button
                  onClick={() => onSettingsChange({ ...settings, density: 'compact' })}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    settings.density === 'compact'
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Vista compacta"
                >
                  <Minimize2 className="w-3 h-3" />
                  Compacta
                </button>
                <button
                  onClick={() => onSettingsChange({ ...settings, density: 'comfortable' })}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    settings.density === 'comfortable'
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Vista cómoda"
                >
                  <Maximize2 className="w-3 h-3" />
                  Cómoda
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TickerCell = ({ ticker, pctChange, assetClass, isStale }) => {
  const assetClassColors = {
    'CEDEAR': 'text-emerald-400',
    'ARGY': 'text-blue-400',
    'BONO HARD DOLLAR': 'text-amber-400',
    'BONOS PESOS': 'text-purple-400'
  };
  const colorClass = assetClassColors[assetClass] || 'text-slate-400';

  return (
    <div className="flex items-center gap-2">
      <span className="font-bold text-white font-mono text-base">{ticker}</span>
      {pctChange !== null && pctChange !== undefined && (
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
          pctChange >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
        }`}>
          {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
        </span>
      )}
      {isStale && (
        <span className="text-[10px] text-amber-500" title="Precio desactualizado">!</span>
      )}
      <span className={`text-[10px] ${colorClass} opacity-60`}>{assetClass}</span>
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

const PositionsTable = memo(({ positions, onRowClick, prices, mepRate, sortConfig, onSortChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [columnSettings, setColumnSettings] = useState(loadColumnSettings);
  const defaultSort = { key: 'valuacionActual', direction: 'desc' };
  const currentSort = sortConfig || defaultSort;

  useEffect(() => {
    saveColumnSettings(columnSettings);
  }, [columnSettings]);

  const handleSettingsChange = (newSettings) => {
    setColumnSettings(newSettings);
  };

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
  const fontSize = columnSettings.density === 'compact' ? 'text-xs' : 'text-sm';

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      <div className={`${paddingY} ${paddingX} border-b border-slate-700/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3`}>
        <h3 className="text-sm font-semibold text-white">Posiciones</h3>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs`}
            />
          </div>
          <ColumnSelector settings={columnSettings} onSettingsChange={handleSettingsChange} />
        </div>
      </div>
      {searchTerm && (
        <div className={`${paddingY} ${paddingX} bg-slate-900/30 border-b border-slate-700/50`}>
          <span className="text-xs text-slate-400">
            {filteredPositions.length} de {positions.length} resultados
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-700/50">
              <th
                className={`text-left ${paddingX} py-2 text-[10px] font-medium text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors`}
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
          <tbody className="divide-y divide-slate-700/30">
            {positionsWithGroup.map((pos) => (
              <tr
                key={pos.ticker}
                className={`hover:bg-slate-700/20 transition-colors cursor-pointer ${pos.isFirstInGroup ? 'border-t border-slate-700/30' : ''}`}
                onClick={() => onRowClick(pos)}
              >
                <td className={`${paddingX} ${paddingY}`}>
                  <TickerCell
                    ticker={pos.ticker}
                    pctChange={pos.pctChange}
                    assetClass={pos.assetClass}
                    isStale={prices[pos.ticker]?.isStale}
                  />
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-slate-300 font-mono text-sm tabular-nums`}>
                  {formatNumber(pos.cantidadTotal)}
                </td>
                {columnSettings.showPPC && (
                  <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono text-xs tabular-nums`}>
                    {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                      ? `$${pos.precioPromedio.toFixed(2)}`
                      : formatARS(pos.precioPromedio)
                    }
                  </td>
                )}
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono font-medium text-sm tabular-nums`}>
                  {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                    ? `$${pos.precioActual.toFixed(2)}`
                    : formatARS(pos.precioActual)
                  }
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono text-sm whitespace-nowrap tabular-nums`}>
                  {formatARS(pos.valuacionActual)}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                  <span className={`font-mono font-medium ${pos.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatARS(pos.resultado)}
                  </span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY}`}>
                  <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                    pos.resultadoPct >= 0
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    {formatPercent(pos.resultadoPct)}
                  </span>
                </td>
                {columnSettings.showDiario && (
                  <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                    <span className={`font-mono text-xs ${pos.resultadoDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatARS(pos.resultadoDiario || 0)}
                    </span>
                  </td>
                )}
                {columnSettings.showDiarioPct && (
                  <td className={`text-right ${paddingX} ${paddingY}`}>
                    <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                      pos.resultadoDiarioPct >= 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {formatPercent(pos.resultadoDiarioPct || 0)}
                    </span>
                  </td>
                )}
              </tr>
            ))}
            {positionsWithGroup.length > 0 && (
              <tr className="bg-slate-900/70 border-t-2 border-slate-600">
                <td className={`${paddingX} ${paddingY} text-left`}>
                  <span className="font-bold text-white text-sm">Total</span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono text-sm tabular-nums`}>-</td>
                {columnSettings.showPPC && <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono text-sm tabular-nums`}>-</td>}
                <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono text-sm tabular-nums`}>-</td>
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono font-bold text-sm whitespace-nowrap tabular-nums`}>
                  {formatUSD(positionsWithGroup.reduce((sum, p) => sum + p.costoUSD, 0))}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono font-bold text-sm whitespace-nowrap tabular-nums`}>
                  {formatUSD(positionsWithGroup.reduce((sum, p) => sum + p.valuacionUSD, 0))}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                  {(() => {
                    const totalResult = positionsWithGroup.reduce((sum, p) => sum + p.resultado, 0);
                    return (
                      <span className={`font-mono font-bold ${totalResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatARS(totalResult)}
                      </span>
                    );
                  })()}
                </td>
                <td className={`text-right ${paddingX} ${paddingY}`}>
                  {(() => {
                    const totalResult = positionsWithGroup.reduce((sum, p) => sum + p.resultado, 0);
                    const totalInvertido = positionsWithGroup.reduce((sum, p) => sum + p.costoTotal, 0);
                    const totalResultPct = totalInvertido > 0 ? (totalResult / totalInvertido) * 100 : 0;
                    return (
                      <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                        totalResultPct >= 0
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}>
                        {formatPercent(totalResultPct)}
                      </span>
                    );
                  })()}
                </td>
                {columnSettings.showDiario && (
                  <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                    {(() => {
                      const totalDiario = positionsWithGroup.reduce((sum, p) => sum + p.resultadoDiario, 0);
                      return (
                        <span className={`font-mono font-bold text-xs ${totalDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatARS(totalDiario)}
                        </span>
                      );
                    })()}
                  </td>
                )}
                {columnSettings.showDiarioPct && (
                  <td className={`text-right ${paddingX} ${paddingY}`}>
                    {(() => {
                      const totalValuation = positionsWithGroup.reduce((sum, p) => sum + p.valuacionActual, 0);
                      const totalDiario = positionsWithGroup.reduce((sum, p) => sum + p.resultadoDiario, 0);
                      const totalDiarioPct = totalValuation > 0 ? (totalDiario / totalValuation) * 100 : 0;
                      return (
                        <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                          totalDiarioPct >= 0
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {formatPercent(totalDiarioPct)}
                        </span>
                      );
                    })()}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
        {positionsWithGroup.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-2">No hay posiciones</p>
            <p className="text-slate-500 text-sm">Importá tus trades o agregalos manualmente</p>
          </div>
        )}
      </div>
    </div>
  );
});

PositionsTable.displayName = 'PositionsTable';

export default PositionsTable;
