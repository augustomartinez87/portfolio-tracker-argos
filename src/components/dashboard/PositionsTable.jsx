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
      className={`text-right px-2 py-2 text-[10px] font-medium text-text-tertiary cursor-pointer select-none hover:text-text-primary transition-colors`}
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
  <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-background-tertiary rounded cursor-pointer transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-border-secondary bg-background-tertiary text-success focus:ring-success focus:ring-offset-background-primary"
    />
    <span className="text-sm text-text-secondary">{label}</span>
  </label>
);

const ColumnSelector = ({ settings, onSettingsChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-background-tertiary rounded-lg transition-colors"
        title="Personalizar columnas"
      >
        <Columns className="w-4 h-4" />
        <span>Columnas</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-background-secondary border border-border-primary rounded-lg shadow-xl p-3 min-w-[200px]">
            <p className="text-xs text-text-tertiary px-2 pb-2 mb-2 border-b border-border-primary">Mostrar/Ocultar columnas</p>
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
            <div className="border-t border-border-primary mt-2 pt-2">
              <p className="text-xs text-text-tertiary px-2 pb-2">Densidad</p>
              <div className="flex gap-1 px-2">
                <button
                  onClick={() => onSettingsChange({ ...settings, density: 'compact' })}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    settings.density === 'compact'
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
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
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
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

const TickerCell = ({ ticker, pctChange, isStale }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-text-primary font-mono text-sm">{ticker}</span>
      {isStale && (
        <span className="text-[10px] text-amber-500" title="Precio desactualizado">!</span>
      )}
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
      pos.ticker.toLowerCase().includes(term)
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

  return (
    <div className="bg-background-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className={`${paddingY} ${paddingX} border-b border-border-primary`}>
        <h3 className="text-sm font-medium text-text-primary">Posiciones</h3>
      </div>
      {searchTerm && (
        <div className={`${paddingY} ${paddingX} bg-background-tertiary/50 border-b border-border-primary`}>
          <span className="text-xs text-text-tertiary">
            {filteredPositions.length} de {positions.length} resultados
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-background-tertiary/30 border-b border-border-primary">
              <th
                className={`text-left ${paddingX} py-2 text-[10px] font-medium text-text-tertiary cursor-pointer select-none hover:text-text-primary transition-colors`}
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
                    pctChange={pos.pctChange}
                    isStale={prices[pos.ticker]?.isStale}
                  />
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-text-secondary font-mono text-xs tabular-nums`}>
                  {formatNumber(pos.cantidadTotal)}
                </td>
                {columnSettings.showPPC && (
                  <td className={`text-right ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs tabular-nums`}>
                    {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                      ? `$${pos.precioPromedio.toFixed(2)}`
                      : formatARS(pos.precioPromedio)
                    }
                  </td>
                )}
                <td className={`text-right ${paddingX} ${paddingY} text-text-primary font-mono font-medium text-xs tabular-nums`}>
                  {(isBonoPesos(pos.ticker) || isBonoHardDollar(pos.ticker))
                    ? `$${pos.precioActual.toFixed(2)}`
                    : formatARS(pos.precioActual)
                  }
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-text-primary font-mono text-xs whitespace-nowrap tabular-nums`}>
                  {formatARS(pos.valuacionActual)}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                  <span className={`font-mono font-medium ${pos.resultado >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatARS(pos.resultado)}
                  </span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY}`}>
                  <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                    pos.resultadoPct >= 0
                      ? 'bg-success/10 text-success'
                      : 'bg-danger/10 text-danger'
                  }`}>
                    {formatPercent(pos.resultadoPct)}
                  </span>
                </td>
                {columnSettings.showDiario && (
                  <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                    <span className={`font-mono text-xs ${pos.resultadoDiario >= 0 ? 'text-success' : 'text-danger'}`}>
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
            {positionsWithGroup.length > 0 && (
              <tr className="bg-background-tertiary/50 border-t-2 border-border-secondary">
                <td className={`${paddingX} ${paddingY} text-left`}>
                  <span className="font-semibold text-text-primary text-xs">Total</span>
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs tabular-nums`}>-</td>
                {columnSettings.showPPC && <td className={`text-right ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs tabular-nums`}>-</td>}
                <td className={`text-right ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs tabular-nums`}>-</td>
                <td className={`text-right ${paddingX} ${paddingY} text-text-primary font-mono font-semibold text-xs whitespace-nowrap tabular-nums`}>
                  {formatUSD(positionsWithGroup.reduce((sum, p) => sum + p.costoUSD, 0))}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} text-text-primary font-mono font-semibold text-xs whitespace-nowrap tabular-nums`}>
                  {formatUSD(positionsWithGroup.reduce((sum, p) => sum + p.valuacionUSD, 0))}
                </td>
                <td className={`text-right ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                  {(() => {
                    const totalResult = positionsWithGroup.reduce((sum, p) => sum + p.resultado, 0);
                    return (
                      <span className={`font-mono font-semibold ${totalResult >= 0 ? 'text-success' : 'text-danger'}`}>
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
                      <span className={`font-semibold px-1.5 py-0.5 rounded text-xs ${
                        totalResultPct >= 0
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
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
                        <span className={`font-mono font-semibold text-xs ${totalDiario >= 0 ? 'text-success' : 'text-danger'}`}>
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
                        <span className={`font-semibold px-1.5 py-0.5 rounded text-xs ${
                          totalDiarioPct >= 0
                            ? 'bg-success/10 text-success'
                            : 'bg-danger/10 text-danger'
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
