import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Edit2, Download, X, ChevronDown, ChevronUp, Search, Info } from 'lucide-react';
import { formatARS, formatNumber } from '@/utils/formatters';
import { DateRangeSelector, getDateRange } from '@/components/common/DateRangeSelector.jsx';

const formatDateDMY = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export function TradesTabContent({
  trades,
  onEditTrade,
  onDeleteTrade,
  onNewTrade,
  onDownloadTemplate,
  onImportCSV,
  isLoading,
  importStatus,
}) {
  const [tradesSearchTerm, setTradesSearchTerm] = useState('');
  const [dateRangeValue, setDateRangeValue] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [showFormatHelp, setShowFormatHelp] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFormatHelp && !event.target.closest('.format-help-tooltip')) {
        setShowFormatHelp(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFormatHelp]);

  const uniqueTickers = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return [];
    return [...new Set(trades.map(t => t.ticker))].sort();
  }, [trades]);

  const sortedTrades = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return [];

    const mappedTrades = trades.map(trade => ({
      ...trade,
      date: trade.trade_date,
      dateFormatted: formatDateDMY(trade.trade_date),
      quantity: trade.quantity,
      price: trade.price,
      type: trade.trade_type === 'buy' ? 'compra' : 'venta'
    }));

    let filtered = mappedTrades;

    if (tradesSearchTerm.trim()) {
      const term = tradesSearchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticker.toLowerCase().includes(term) ||
        t.dateFormatted.includes(term)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    if (tickerFilter !== 'all') {
      filtered = filtered.filter(t => t.ticker === tickerFilter);
    }

    if (dateRangeValue !== 'all') {
      const { startDate } = getDateRange(dateRangeValue);
      if (startDate) {
        filtered = filtered.filter(t => new Date(t.date) >= startDate);
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'date') {
        aVal = aVal ? new Date(aVal) : new Date();
        bVal = bVal ? new Date(bVal) : new Date();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [trades, sortConfig, tradesSearchTerm, typeFilter, tickerFilter, dateRangeValue]);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 lg:space-y-6 overflow-y-auto pr-1">
      {/* Filtros */}
      <div className="bg-background-secondary border border-border-primary rounded-xl p-3 sm:p-4 lg:p-5">
        <div className="mb-3 lg:mb-0 lg:hidden">
          <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Buscar por ticker, fecha..."
              value={tradesSearchTerm}
              onChange={(e) => setTradesSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row gap-3 lg:gap-4">
          <div className="hidden lg:block lg:flex-[2]">
            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Buscar por ticker, fecha..."
                value={tradesSearchTerm}
                onChange={(e) => setTradesSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="lg:flex-[1.5]">
            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Período</label>
            <DateRangeSelector selectedRange={dateRangeValue} onChange={setDateRangeValue} className="w-full justify-between" />
          </div>

          <div className="lg:flex-1">
            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 lg:px-4 py-2.5 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="compra">Compra</option>
              <option value="venta">Venta</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1 lg:flex-1">
            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Activo</label>
            <select
              value={tickerFilter}
              onChange={(e) => setTickerFilter(e.target.value)}
              className="w-full px-3 lg:px-4 py-2.5 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="all">Todos</option>
              {uniqueTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-3 sm:p-4 border-b border-border-primary flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-text-primary">Transacciones</h2>
            <span className="text-xs text-text-tertiary bg-background-tertiary px-2 py-0.5 rounded-full">
              {sortedTrades.length}{sortedTrades.length !== trades.length && `/${trades.length}`}
            </span>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <div className="relative">
              <button
                onClick={() => setShowFormatHelp(!showFormatHelp)}
                className={`flex items-center justify-center h-8 w-8 rounded-lg transition-colors text-xs font-medium border ${showFormatHelp ? 'bg-primary/20 text-primary border-primary/30' : 'bg-background-tertiary text-text-secondary border-border-primary hover:text-text-primary hover:bg-border-primary'}`}
                title="Formato de archivo"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {showFormatHelp && (
                <div className="format-help-tooltip absolute right-0 top-full mt-2 w-72 sm:w-80 bg-background-secondary border border-border-primary rounded-lg shadow-xl z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-text-primary text-sm">Formato del CSV</h4>
                    <button onClick={() => setShowFormatHelp(false)} className="text-text-tertiary hover:text-text-primary">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs text-text-secondary">
                    <p className="font-medium text-text-primary">Columnas requeridas:</p>
                    <ul className="list-disc list-inside space-y-1 ml-1">
                      <li><span className="text-primary font-mono">Fecha</span> - Formato DD/MM/AAAA</li>
                      <li><span className="text-primary font-mono">Ticker</span> - Ej: MELI, GGAL, AL30</li>
                      <li><span className="text-primary font-mono">Cantidad</span> - Positivo=compra, Negativo=venta</li>
                      <li><span className="text-primary font-mono">Precio</span> - Precio por unidad en ARS</li>
                    </ul>
                    <div className="mt-3 p-2 bg-background-tertiary rounded text-[10px] font-mono">
                      <p className="text-text-tertiary mb-1">Ejemplo:</p>
                      <p>Fecha,Ticker,Cantidad,Precio</p>
                      <p>23/12/2024,MELI,10,17220</p>
                      <p>15/01/2025,GGAL,-5,4500</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={onDownloadTemplate} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 h-8 w-8 sm:w-auto bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary" title="Descargar plantilla">
              <Download className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Plantilla</span>
            </button>
            <label className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 h-8 w-8 sm:w-auto bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary cursor-pointer" title="Importar CSV">
              <Download className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Importar</span>
              <input type="file" accept=".csv" onChange={onImportCSV} className="hidden" disabled={isLoading} />
            </label>
            <button onClick={onNewTrade} className="flex items-center justify-center gap-1.5 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20" title="Nueva transacción">
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          </div>
        </div>

        {importStatus && (
          <div className={`px-4 py-2 text-sm border-b ${importStatus.includes('Error') || importStatus.includes('error') ? 'bg-danger/10 text-danger border-danger/30' : importStatus.includes('importadas') ? 'bg-success/10 text-success border-success/30' : 'bg-background-tertiary text-text-secondary'}`}>
            {importStatus}
          </div>
        )}

        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full min-w-[700px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-background-tertiary text-left text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">Fecha {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                </th>
                <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('ticker')}>
                  <div className="flex items-center gap-1">Ticker {sortConfig.key === 'ticker' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                </th>
                <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('type')}>
                  <div className="flex items-center gap-1">Tipo {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                </th>
                <th className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">Cant.</th>
                <th className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">Precio</th>
                <th className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {sortedTrades.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-text-tertiary text-sm">
                  {trades.length === 0 ? 'No hay transacciones registradas' : 'No hay transacciones que coincidan con los filtros'}
                </td></tr>
              ) : sortedTrades.map((trade, idx) => (
                <tr key={trade.id || idx} className="hover:bg-background-tertiary transition-all duration-200">
                  <td className="px-3 sm:px-4 py-3 text-sm text-text-primary whitespace-nowrap">{trade.dateFormatted}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm font-bold text-text-primary whitespace-nowrap">{trade.ticker}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <span className={`inline-flex px-2 sm:px-3 py-1 rounded-md text-xs font-semibold border ${trade.type === 'compra'
                      ? 'bg-success/10 text-success border-success/30'
                      : 'bg-danger/10 text-danger border-danger/30'
                    }`}>
                      {trade.type === 'compra' ? 'Compra' : 'Venta'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatNumber(Math.abs(trade.quantity), 2)}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatARS(trade.price)}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatARS(Math.abs(trade.quantity) * trade.price)}</td>
                  <td className="px-3 sm:px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onEditTrade(trade)} className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-tertiary rounded transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onDeleteTrade(trade)} className="p-1.5 text-text-tertiary hover:text-danger hover:bg-background-tertiary rounded transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
