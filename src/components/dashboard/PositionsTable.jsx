import React, { memo, useState, useMemo, useEffect } from 'react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../../utils/formatters';
import { isBonoPesos, isBonoHardDollar } from '../../hooks/useBondPrices';
import { ArrowUp, ArrowDown, Search, Settings2, Eye, EyeOff, Columns, Minimize2, Maximize2 } from 'lucide-react';

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
  density: 'comfortable'
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

const SortHeader = ({ label, sortKey, currentSort, onSort, compact }) => {
  const isActive = currentSort.key === sortKey;
  const isAsc = isActive && currentSort.direction === 'asc';
  const isDesc = isActive && currentSort.direction === 'desc';

  return (
    <th
      className={`text-right px-3 py-2 text-xs font-medium tracking-wide cursor-pointer select-none transition-colors ${
        isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
      }`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-end gap-1.5">
        <span>{label}</span>
        {isActive ? (
          isAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <span className="opacity-30 text-xs">↕</span>
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

  const paddingY = columnSettings.density === 'compact' ? 'py-2' : 'py-3';
  const paddingX = columnSettings.density === 'compact' ? 'px-3' : 'px-4';
  const fontSize = columnSettings.density === 'compact' ? 'text-xs' : 'text-sm';
  const headerPaddingY = columnSettings.density === 'compact' ? 'py-2' : 'py-3';

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      <div className={`${paddingY} ${paddingX} border-b border-slate-700/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3`}>
        <h3 className="text-base font-semibold text-white">Posiciones</h3>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 ${columnSettings.density === 'compact' ? 'py-1.5' : 'py-2'} bg-slate-900/50 border border-slate-600 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm`}
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
                className={`text-left ${paddingX} ${headerPaddingY} text-xs font-medium tracking-wide text-slate-400 cursor-pointer select-none hover:text-white transition-colors`}
                onClick={() => handleSort('ticker')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Ticker</span>
                  {currentSort.key === 'ticker' && (
                    currentSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </div>
              </th>
              <SortHeader label="Cant." sortKey="cantidadTotal" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              {columnSettings.showPPC && (
                <SortHeader label="PPC" sortKey="precioPromedio" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              )}
              <SortHeader label="P. Actual" sortKey="precioActual" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              <SortHeader label="Valuación" sortKey="valuacionActual" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              <SortHeader label="P&L $" sortKey="resultado" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              <SortHeader label="P&L %" sortKey="resultadoPct" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              {columnSettings.showDiario && (
                <SortHeader label="P&L Diario $" sortKey="resultadoDiario" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              )}
              {columnSettings.showDiarioPct && (
                <SortHeader label="P&L Diario %" sortKey="resultadoDiarioPct" currentSort={currentSort} onSort={handleSort} compact={columnSettings.density === 'compact'} />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sortedPositions.map((pos) => (
              <tr
                key={pos.ticker}
                className={`hover:bg-slate-700/20 transition-colors cursor-pointer`}
                onClick={() => onRowClick(pos)}
              >
                <td className={`${paddingX} ${paddingY}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white font-mono text-sm">{pos.ticker}</span>
                    {pos.pctChange !== null && pos.pctChange !== undefined && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        pos.pctChange >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {pos.pctChange >= 0 ? '+' : ''}{pos.pctChange.toFixed(2)}%
                      </span>
                    )}
                    {prices[pos.ticker]?.isStale && (
                      <span className="text-xs text-amber-400" title="Precio desactualizado">⚠</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{pos.assetClass}</span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-slate-300 font-mono text-sm`}>
                  {formatNumber(pos.cantidadTotal)}
                </td>
                {columnSettings.showPPC && (
                  <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono ${fontSize}`}>
                    {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                      ? `$${pos.precioPromedio.toFixed(2)}`
                      : formatARS(pos.precioPromedio)
                    }
                  </td>
                )}
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono font-medium ${fontSize}`}>
                  {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                    ? `$${pos.precioActual.toFixed(2)}`
                    : formatARS(pos.precioActual)
                  }
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono ${fontSize} whitespace-nowrap`}>
                  {formatARS(pos.valuacionActual)}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap`}>
                  <span className={`font-mono font-medium ${pos.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatARS(pos.resultado)}
                  </span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY}`}>
                  <span className={`font-medium px-2 py-0.5 rounded ${
                    pos.resultadoPct >= 0
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    {formatPercent(pos.resultadoPct)}
                  </span>
                </td>
                {columnSettings.showDiario && (
                  <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap`}>
                    <span className={`font-mono ${pos.resultadoDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatARS(pos.resultadoDiario || 0)}
                    </span>
                  </td>
                )}
                {columnSettings.showDiarioPct && (
                  <td className={`text-right ${paddingX} ${paddingY}`}>
                    <span className={`font-medium px-2 py-0.5 rounded ${
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
            {sortedPositions.length > 0 && (
              <tr className="bg-slate-900/50 border-t-2 border-slate-600">
                <td className={`${paddingX} ${paddingY} text-left`}>
                  <span className="font-bold text-white text-sm uppercase tracking-wide">Total</span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono text-sm`}>-</td>
                {columnSettings.showPPC && <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono text-sm`}>-</td>}
                <td className={`text-right ${paddingX} ${paddingY} text-slate-400 font-mono text-sm`}>-</td>
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono font-bold ${fontSize} whitespace-nowrap`}>
                  {formatUSD(sortedPositions.reduce((sum, p) => sum + p.costoUSD, 0))}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-white font-mono font-bold ${fontSize} whitespace-nowrap`}>
                  {formatUSD(sortedPositions.reduce((sum, p) => sum + p.valuacionUSD, 0))}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap`}>
                  {(() => {
                    const totalResult = sortedPositions.reduce((sum, p) => sum + p.resultado, 0);
                    return (
                      <span className={`font-mono font-bold ${totalResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatARS(totalResult)}
                      </span>
                    );
                  })()}
                </td>
                <td className={`text-right ${paddingX} ${paddingY}`}>
                  {(() => {
                    const totalResult = sortedPositions.reduce((sum, p) => sum + p.resultado, 0);
                    const totalInvertido = sortedPositions.reduce((sum, p) => sum + p.costoTotal, 0);
                    const totalResultPct = totalInvertido > 0 ? (totalResult / totalInvertido) * 100 : 0;
                    return (
                      <span className={`font-bold px-2 py-0.5 rounded ${
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
                  <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap`}>
                    {(() => {
                      const totalDiario = sortedPositions.reduce((sum, p) => sum + p.resultadoDiario, 0);
                      return (
                        <span className={`font-mono font-bold ${totalDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatARS(totalDiario)}
                        </span>
                      );
                    })()}
                  </td>
                )}
                {columnSettings.showDiarioPct && (
                  <td className={`text-right ${paddingX} ${paddingY}`}>
                    {(() => {
                      const totalValuation = sortedPositions.reduce((sum, p) => sum + p.valuacionActual, 0);
                      const totalDiario = sortedPositions.reduce((sum, p) => sum + p.resultadoDiario, 0);
                      const totalDiarioPct = totalValuation > 0 ? (totalDiario / totalValuation) * 100 : 0;
                      return (
                        <span className={`font-bold px-2 py-0.5 rounded ${
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
        {sortedPositions.length === 0 && (
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
