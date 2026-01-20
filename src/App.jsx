import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, AlertCircle, Loader2, Activity, Zap } from 'lucide-react';

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatARS = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatUSD = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

const parseARSNumber = (str) => {
  if (!str) return 0;
  const cleaned = str.toString()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  return parseFloat(cleaned) || 0;
};

const parseDateDMY = (str) => {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return str;
};

// Asset class mapping based on data912 panel + custom logic
const getAssetClass = (ticker, panel, isArgStock = false) => {
  // Bonos en pesos (letras, boncer, etc)
  if (ticker.startsWith('T') && (ticker.includes('X') || ticker.includes('E'))) {
    return 'BONOS PESOS';
  }

  // Bonos hard dollar
  if (panel === 'bonds' || ['AE38', 'AL29', 'AL30', 'AL35', 'AL41', 'GD29', 'GD30', 'GD35', 'GD38', 'GD41', 'GD46'].includes(ticker)) {
    return 'BONOS HD';
  }

  // Acciones argentinas
  if (isArgStock || ['GGAL', 'YPFD', 'VIST', 'PAMP', 'TXAR', 'ALUA', 'BMA', 'SUPV', 'CEPU', 'EDN', 'TGSU2', 'TRAN', 'CRES', 'LOMA', 'COME', 'BBAR', 'BYMA', 'MIRG', 'VALO', 'IRSA', 'METR'].includes(ticker)) {
    return 'ARGY';
  }

  // CEDEARs (default for panel === 'cedear')
  if (panel === 'cedear') {
    return 'CEDEAR';
  }

  return 'OTROS';
};

// ============================================
// CUSTOM HOOKS
// ============================================

const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

// ============================================
// COMPONENTS
// ============================================

// Ticker Autocomplete Component
const TickerAutocomplete = ({ value, onChange, tickers, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredTickers = useMemo(() => {
    if (!search) return tickers.slice(0, 50);
    const searchUpper = search.toUpperCase();
    return tickers
      .filter(t => t.ticker.toUpperCase().includes(searchUpper))
      .slice(0, 50);
  }, [search, tickers]);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (ticker) => {
    setSearch(ticker.ticker);
    onChange(ticker.ticker);
    setIsOpen(false);
  };

  const assetClassColors = {
    'CEDEAR': 'text-emerald-400',
    'ARGY': 'text-blue-400',
    'BONOS HD': 'text-amber-400',
    'BONOS PESOS': 'text-purple-400',
    'OTROS': 'text-slate-400'
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.toUpperCase());
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        disabled={disabled}
        placeholder="Buscar ticker..."
        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
      />
      {isOpen && filteredTickers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-slate-800 border border-slate-600 rounded-lg shadow-2xl"
        >
          {filteredTickers.map((ticker) => (
            <button
              key={ticker.ticker}
              onClick={() => handleSelect(ticker)}
              className="w-full px-3 py-2.5 text-left hover:bg-slate-700 transition-colors flex justify-between items-center border-b border-slate-700/50 last:border-0"
            >
              <span className="text-white font-mono font-medium">{ticker.ticker}</span>
              <span className={`text-xs font-medium ${assetClassColors[ticker.assetClass] || 'text-slate-400'}`}>
                {ticker.assetClass}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Trade Form Modal
const TradeModal = ({ isOpen, onClose, onSave, trade, tickers }) => {
  const [formData, setFormData] = useState({
    fecha: '',
    ticker: '',
    cantidad: '',
    precioCompra: ''
  });

  useEffect(() => {
    if (trade) {
      setFormData({
        fecha: trade.fecha || '',
        ticker: trade.ticker || '',
        cantidad: trade.cantidad?.toString() || '',
        precioCompra: trade.precioCompra?.toString() || ''
      });
    } else {
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        ticker: '',
        cantidad: '',
        precioCompra: ''
      });
    }
  }, [trade, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: trade?.id || crypto.randomUUID(),
      fecha: formData.fecha,
      ticker: formData.ticker.toUpperCase(),
      cantidad: parseFloat(formData.cantidad) || 0,
      precioCompra: parseFloat(formData.precioCompra) || 0
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {trade ? 'Editar Trade' : 'Nuevo Trade'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Ticker</label>
            <TickerAutocomplete
              value={formData.ticker}
              onChange={(ticker) => setFormData({...formData, ticker})}
              tickers={tickers}
              disabled={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Cantidad</label>
              <input
                type="number"
                step="any"
                value={formData.cantidad}
                onChange={(e) => setFormData({...formData, cantidad: e.target.value})}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Precio (ARS)</label>
              <input
                type="number"
                step="any"
                value={formData.precioCompra}
                onChange={(e) => setFormData({...formData, precioCompra: e.target.value})}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-semibold"
            >
              {trade ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete Confirmation Modal
const DeleteModal = ({ isOpen, onClose, onConfirm, tradeTicker }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Eliminar Trade</h3>
          <p className="text-slate-400 mb-6">
            ¿Eliminar este trade de <span className="text-white font-semibold font-mono">{tradeTicker}</span>?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-semibold"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, subValue, icon: Icon, trend, isLoading, highlight }) => (
  <div className={`bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border transition-all duration-300 ${
    highlight ? 'border-emerald-500/50 shadow-emerald-500/10 shadow-lg' : 'border-slate-700/50 hover:border-slate-600'
  }`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        {isLoading ? (
          <div className="h-8 w-32 bg-slate-700 animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-bold text-white font-mono tracking-tight">{value}</p>
        )}
        {subValue && !isLoading && (
          <p className={`text-sm mt-1 font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {subValue}
          </p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${
        trend > 0 ? 'bg-emerald-500/15' :
        trend < 0 ? 'bg-red-500/15' :
        'bg-slate-700/50'
      }`}>
        <Icon className={`w-5 h-5 ${
          trend > 0 ? 'text-emerald-400' :
          trend < 0 ? 'text-red-400' :
          'text-slate-400'
        }`} />
      </div>
    </div>
  </div>
);

// Asset Class Breakdown Component
const AssetBreakdown = ({ positions, totalValue }) => {
  const breakdown = useMemo(() => {
    const groups = {};
    positions.forEach(pos => {
      const assetClass = pos.assetClass || 'OTROS';
      if (!groups[assetClass]) {
        groups[assetClass] = { value: 0, count: 0, resultado: 0 };
      }
      groups[assetClass].value += pos.valuacionActual || 0;
      groups[assetClass].count += 1;
      groups[assetClass].resultado += pos.resultado || 0;
    });
    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.count,
        resultado: data.resultado,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions, totalValue]);

  const colors = {
    'CEDEAR': { bg: 'bg-emerald-500', text: 'text-emerald-400' },
    'ARGY': { bg: 'bg-blue-500', text: 'text-blue-400' },
    'BONOS HD': { bg: 'bg-amber-500', text: 'text-amber-400' },
    'BONOS PESOS': { bg: 'bg-purple-500', text: 'text-purple-400' },
    'OTROS': { bg: 'bg-slate-500', text: 'text-slate-400' }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-emerald-400" />
        Distribución por Asset Class
      </h3>
      <div className="space-y-4">
        {breakdown.map((item) => (
          <div key={item.name}>
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors[item.name]?.bg || colors['OTROS'].bg}`} />
                <span className="text-sm font-medium text-slate-300">{item.name}</span>
                <span className="text-xs text-slate-500">({item.count})</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono text-white">{item.percentage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[item.name]?.bg || colors['OTROS'].bg} rounded-full transition-all duration-700`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-500">{formatARS(item.value)}</span>
              <span className={`text-xs font-medium ${item.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatARS(item.resultado)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function PortfolioTracker() {
  const [trades, setTrades] = useLocalStorage('portfolio-trades-v2', []);
  const [prices, setPrices] = useLocalStorage('portfolio-prices-v2', {});
  const [tickers, setTickers] = useState([]);
  const [mepRate, setMepRate] = useState(1467);
  const [isLoading, setIsLoading] = useState(false);
  const [isPricesLoading, setIsPricesLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingTrade, setDeletingTrade] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });
  const [expandedPositions, setExpandedPositions] = useState({});
  const [dataSource, setDataSource] = useState({ mep: 0, argStocks: 0, cedears: 0 });

  // Fetch prices from multiple data912 endpoints
  const fetchPrices = useCallback(async () => {
    setIsPricesLoading(true);
    const priceMap = {};
    const tickerList = [];
    let sources = { mep: 0, argStocks: 0, cedears: 0 };

    try {
      // Fetch from /live/mep (main source - has bonds + cedears with MEP calc)
      const mepResponse = await fetch('https://data912.com/live/mep', {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      if (!mepResponse.ok) throw new Error('Failed to fetch MEP data');
      const mepData = await mepResponse.json();

      let avgMep = 0;
      let mepCount = 0;

      mepData.forEach(item => {
        const assetClass = getAssetClass(item.ticker, item.panel);
        priceMap[item.ticker] = {
          precio: item.mark || item.close,
          bid: item.bid,
          ask: item.ask,
          close: item.close,
          panel: item.panel,
          assetClass,
          source: 'mep',
          pctChange: null // MEP endpoint doesn't have pct_change
        };

        tickerList.push({
          ticker: item.ticker,
          panel: item.panel,
          assetClass
        });

        sources.mep++;

        // Calculate average MEP from liquid tickers
        if (item.mark > 1400 && item.mark < 1600 && item.panel === 'cedear') {
          avgMep += item.mark;
          mepCount++;
        }
      });

      if (mepCount > 0) {
        setMepRate(avgMep / mepCount);
      }

      // Fetch from /live/arg_stocks (local Argentine stocks)
      try {
        const argStocksResponse = await fetch('https://data912.com/live/arg_stocks', {
          signal: AbortSignal.timeout(10000)
        });
        if (!argStocksResponse.ok) throw new Error('Failed to fetch arg_stocks');
        const argStocksData = await argStocksResponse.json();

        argStocksData.forEach(item => {
          const ticker = item.symbol;
          // Skip D versions (dollar) for now
          if (ticker.endsWith('D')) return;

          const assetClass = getAssetClass(ticker, null, true);

          // Only add if not already in priceMap or update with pct_change
          if (!priceMap[ticker]) {
            priceMap[ticker] = {
              precio: item.c || item.px_ask || item.px_bid,
              bid: item.px_bid,
              ask: item.px_ask,
              close: item.c,
              panel: 'arg_stock',
              assetClass,
              source: 'arg_stocks',
              pctChange: item.pct_change
            };

            tickerList.push({
              ticker,
              panel: 'arg_stock',
              assetClass
            });

            sources.argStocks++;
          } else {
            // Update pct_change from this source
            priceMap[ticker].pctChange = item.pct_change;
          }
        });
      } catch (e) {
        console.warn('Could not fetch arg_stocks:', e);
      }

      // Fetch from /live/arg_cedears (has pct_change)
      try {
        const cedearsResponse = await fetch('https://data912.com/live/arg_cedears', {
          signal: AbortSignal.timeout(10000)
        });
        if (!cedearsResponse.ok) throw new Error('Failed to fetch arg_cedears');
        const cedearsData = await cedearsResponse.json();

        cedearsData.forEach(item => {
          const ticker = item.symbol;
          // Skip D (dollar) and C (cable) versions
          if (ticker.endsWith('D') || ticker.endsWith('C')) return;

          // Update pct_change for existing tickers
          if (priceMap[ticker]) {
            priceMap[ticker].pctChange = item.pct_change;
            // Update price if newer
            if (item.c && item.c > 0) {
              priceMap[ticker].precio = item.c;
              priceMap[ticker].close = item.c;
            }
          }
          sources.cedears++;
        });
      } catch (e) {
        console.warn('Could not fetch arg_cedears:', e);
      }

      setPrices(priceMap);
      setTickers(tickerList.sort((a, b) => a.ticker.localeCompare(b.ticker)));
      setDataSource(sources);
      setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));

    } catch (error) {
      console.error('Error fetching prices:', error);
      // No mostrar alerta molesta - puede ser que el mercado esté cerrado
      // Solo actualizar el timestamp para indicar que se intentó
      setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' (error)');
    } finally {
      setIsPricesLoading(false);
    }
  }, [setPrices]);

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Download CSV template
  const downloadTemplate = () => {
    const csvContent = `Fecha,Ticker,Cantidad,Precio
23/12/2024,MELI,10,17220
03/04/2025,MSFT,31,16075
07/04/2025,SPY,15,33800`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'portfolio_trades_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import from CSV file
  const importFromCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setImportStatus('Importando...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').slice(1); // Skip header
        const newTrades = [];

        lines.forEach((line) => {
          if (!line.trim()) return;

          const cols = line.split(',').map(col => col.trim());
          const fecha = cols[0];
          const ticker = cols[1];
          const cantidad = cols[2];
          const precio = cols[3];

          if (!fecha || !ticker || ticker === 'Ticker') return;

          const parsedDate = parseDateDMY(fecha);
          const parsedCantidad = parseARSNumber(cantidad);
          const parsedPrecio = parseARSNumber(precio);

          if (parsedDate && ticker && parsedCantidad > 0) {
            newTrades.push({
              id: crypto.randomUUID(),
              fecha: parsedDate,
              ticker: ticker.trim().toUpperCase(),
              cantidad: parsedCantidad,
              precioCompra: parsedPrecio
            });
          }
        });

        if (newTrades.length > 0) {
          setTrades(newTrades);
          setImportStatus(`✓ ${newTrades.length} trades importados`);
          setTimeout(() => setImportStatus(null), 3000);
        } else {
          setImportStatus('No se encontraron trades válidos');
          setTimeout(() => setImportStatus(null), 3000);
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        setImportStatus('Error al importar archivo');
        setTimeout(() => setImportStatus(null), 3000);
      } finally {
        setIsLoading(false);
        event.target.value = null; // Reset input
      }
    };

    reader.onerror = () => {
      setImportStatus('Error al leer archivo');
      setTimeout(() => setImportStatus(null), 3000);
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  // Import from Google Sheets
  const importFromGoogleSheets = async () => {
    setIsLoading(true);
    setImportStatus('Importando...');
    try {
      const response = await fetch(
        'https://docs.google.com/spreadsheets/d/14kSIrwStgETRML-_1qCOl4F_F-tdXRHTKch5PdwUMLM/gviz/tq?tqx=out:csv&sheet=Trades'
      );
      const csvText = await response.text();

      const lines = csvText.split('\n').slice(1);
      const newTrades = [];

      lines.forEach((line) => {
        if (!line.trim()) return;

        const matches = line.match(/("([^"]*)"|[^,]*)(,|$)/g);
        if (!matches) return;

        const cols = matches.map(m => m.replace(/^"|"$|,$/g, '').trim());

        const fecha = cols[1];
        const ticker = cols[2];
        const cantidad = cols[3];
        const precio = cols[4];

        if (!fecha || !ticker || ticker === 'Ticker') return;

        const parsedDate = parseDateDMY(fecha);
        const parsedCantidad = parseARSNumber(cantidad);
        const parsedPrecio = parseARSNumber(precio);

        if (parsedDate && ticker && parsedCantidad > 0) {
          newTrades.push({
            id: crypto.randomUUID(),
            fecha: parsedDate,
            ticker: ticker.trim().toUpperCase(),
            cantidad: parsedCantidad,
            precioCompra: parsedPrecio
          });
        }
      });

      if (newTrades.length > 0) {
        setTrades(newTrades);
        setImportStatus(`✓ ${newTrades.length} trades importados`);
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus('No se encontraron trades');
        setTimeout(() => setImportStatus(null), 3000);
      }
    } catch (error) {
      console.error('Error importing:', error);
      setImportStatus('Error al importar');
      setTimeout(() => setImportStatus(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate positions (grouped trades)
  const positions = useMemo(() => {
    const grouped = {};

    trades.forEach(trade => {
      if (!grouped[trade.ticker]) {
        grouped[trade.ticker] = {
          ticker: trade.ticker,
          trades: [],
          cantidadTotal: 0,
          costoTotal: 0
        };
      }
      grouped[trade.ticker].trades.push(trade);
      grouped[trade.ticker].cantidadTotal += trade.cantidad;
      grouped[trade.ticker].costoTotal += trade.cantidad * trade.precioCompra;
    });

    return Object.values(grouped).map(pos => {
      const priceData = prices[pos.ticker];
      const precioActual = priceData?.precio || 0;
      const precioPromedio = pos.cantidadTotal > 0 ? pos.costoTotal / pos.cantidadTotal : 0;
      const valuacionActual = pos.cantidadTotal * precioActual;
      const resultado = valuacionActual - pos.costoTotal;
      const resultadoPct = pos.costoTotal > 0 ? (resultado / pos.costoTotal) * 100 : 0;

      return {
        ...pos,
        precioPromedio,
        precioActual,
        valuacionActual,
        resultado,
        resultadoPct,
        assetClass: priceData?.assetClass || getAssetClass(pos.ticker, priceData?.panel),
        pctChange: priceData?.pctChange,
        // USD calculations
        costoUSD: pos.costoTotal / mepRate,
        valuacionUSD: valuacionActual / mepRate,
        resultadoUSD: resultado / mepRate
      };
    }).sort((a, b) => b.valuacionActual - a.valuacionActual);
  }, [trades, prices, mepRate]);

  // Portfolio totals
  const totals = useMemo(() => {
    const invertido = positions.reduce((sum, p) => sum + p.costoTotal, 0);
    const valuacion = positions.reduce((sum, p) => sum + p.valuacionActual, 0);
    const resultado = valuacion - invertido;
    const resultadoPct = invertido > 0 ? (resultado / invertido) * 100 : 0;

    return {
      invertido,
      valuacion,
      resultado,
      resultadoPct,
      invertidoUSD: invertido / mepRate,
      valuacionUSD: valuacion / mepRate,
      resultadoUSD: resultado / mepRate
    };
  }, [positions, mepRate]);

  // Sorted trades for the trades tab
  const sortedTrades = useMemo(() => {
    const sorted = [...trades].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'fecha') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [trades, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSaveTrade = (trade) => {
    if (editingTrade) {
      setTrades(prev => prev.map(t => t.id === trade.id ? trade : t));
    } else {
      setTrades(prev => [...prev, trade]);
    }
    setModalOpen(false);
    setEditingTrade(null);
  };

  const handleDeleteTrade = () => {
    if (deletingTrade) {
      setTrades(prev => prev.filter(t => t.id !== deletingTrade.id));
      setDeleteModalOpen(false);
      setDeletingTrade(null);
    }
  };

  const togglePosition = (ticker) => {
    setExpandedPositions(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Zap className="w-6 h-6 text-emerald-400" />
                Portfolio Tracker
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-slate-400">
                  MEP: <span className="text-emerald-400 font-mono font-medium">{formatARS(mepRate)}</span>
                </span>
                {lastUpdate && (
                  <span className="text-xs text-slate-500">
                    • {lastUpdate}
                  </span>
                )}
                <span className="text-xs text-slate-600">
                  • {dataSource.mep + dataSource.argStocks} tickers
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchPrices}
                disabled={isPricesLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-all border border-slate-700 text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${isPricesLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {['dashboard', 'trades'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeTab === tab
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab === 'dashboard' ? 'Dashboard' : 'Trades'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                title="Invertido"
                value={formatARS(totals.invertido)}
                subValue={formatUSD(totals.invertidoUSD)}
                icon={Activity}
                isLoading={isPricesLoading}
              />
              <SummaryCard
                title="Valuación Actual"
                value={formatARS(totals.valuacion)}
                subValue={formatUSD(totals.valuacionUSD)}
                icon={TrendingUp}
                trend={totals.resultado}
                isLoading={isPricesLoading}
                highlight
              />
              <SummaryCard
                title="Resultado ARS"
                value={formatARS(totals.resultado)}
                subValue={formatPercent(totals.resultadoPct)}
                icon={totals.resultado >= 0 ? TrendingUp : TrendingDown}
                trend={totals.resultado}
                isLoading={isPricesLoading}
              />
              <SummaryCard
                title="Resultado USD"
                value={formatUSD(totals.resultadoUSD)}
                subValue={formatPercent(totals.resultadoPct)}
                icon={totals.resultadoUSD >= 0 ? TrendingUp : TrendingDown}
                trend={totals.resultadoUSD}
                isLoading={isPricesLoading}
              />
            </div>

            {/* Asset Breakdown + Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <AssetBreakdown positions={positions} totalValue={totals.valuacion} />
              </div>
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Resumen</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">Posiciones</span>
                    <span className="text-white font-semibold font-mono">{positions.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">Trades Totales</span>
                    <span className="text-white font-semibold font-mono">{trades.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">Tipo Cambio MEP</span>
                    <span className="text-emerald-400 font-semibold font-mono">{formatARS(mepRate)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Data Sources</span>
                    <span className="text-slate-300 text-sm">data912.com</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Positions Table */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Posiciones</h3>
                <span className="text-sm text-slate-400">{positions.length} activos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticker</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Cant.</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">P. Prom.</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">P. Actual</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Invertido</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valuación</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {positions.map((pos) => (
                      <React.Fragment key={pos.ticker}>
                        <tr
                          className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                          onClick={() => togglePosition(pos.ticker)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`transition-transform ${expandedPositions[pos.ticker] ? 'rotate-180' : ''}`}>
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              </div>
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
                                </div>
                                <span className="text-xs text-slate-500">{pos.assetClass}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-4 py-3 text-slate-300 font-mono hidden sm:table-cell">
                            {formatNumber(pos.cantidadTotal)}
                          </td>
                          <td className="text-right px-4 py-3 text-slate-400 font-mono text-sm hidden md:table-cell">
                            {formatARS(pos.precioPromedio)}
                          </td>
                          <td className="text-right px-4 py-3 text-white font-mono font-medium">
                            {formatARS(pos.precioActual)}
                          </td>
                          <td className="text-right px-4 py-3 text-slate-400 font-mono text-sm hidden lg:table-cell">
                            {formatARS(pos.costoTotal)}
                          </td>
                          <td className="text-right px-4 py-3 text-white font-mono font-medium">
                            {formatARS(pos.valuacionActual)}
                          </td>
                          <td className="text-right px-4 py-3">
                            <div className={`font-mono font-medium ${pos.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatARS(pos.resultado)}
                              <span className="block text-xs opacity-80">
                                {formatPercent(pos.resultadoPct)}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {expandedPositions[pos.ticker] && (
                          <tr className="bg-slate-900/50">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="text-sm pl-6">
                                <p className="text-slate-400 mb-2 font-medium">Trades ({pos.trades.length})</p>
                                <div className="space-y-1">
                                  {pos.trades.map(trade => (
                                    <div key={trade.id} className="flex justify-between items-center py-2 px-3 bg-slate-800/50 rounded-lg">
                                      <span className="text-slate-400 text-xs">{new Date(trade.fecha).toLocaleDateString('es-AR')}</span>
                                      <span className="text-white font-mono text-sm">{formatNumber(trade.cantidad)} @ {formatARS(trade.precioCompra)}</span>
                                      <span className="text-slate-400 font-mono text-sm">{formatARS(trade.cantidad * trade.precioCompra)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
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
          </>
        ) : (
          <>
            {/* Trades Tab */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setEditingTrade(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all font-semibold shadow-lg shadow-emerald-600/25"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Trade
                </button>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-all font-semibold shadow-lg shadow-purple-600/25"
                >
                  <Download className="w-4 h-4" />
                  Descargar Template Excel
                </button>
                <label className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all font-semibold shadow-lg shadow-blue-600/25 cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={importFromCSV}
                    disabled={isLoading}
                    className="hidden"
                  />
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Importar CSV/Excel
                </label>
                <button
                  onClick={importFromGoogleSheets}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all font-semibold disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Importar Google Sheets
                </button>
              </div>
              {importStatus && (
                <span className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                  importStatus.includes('✓') ? 'bg-emerald-500/20 text-emerald-400' :
                  importStatus.includes('Error') ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {importStatus}
                </span>
              )}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
                <p className="text-blue-300 font-medium mb-2">📋 Formato del archivo CSV/Excel:</p>
                <ul className="text-slate-300 space-y-1 ml-4">
                  <li>• <strong>Fecha:</strong> DD/MM/YYYY (ejemplo: 23/12/2024)</li>
                  <li>• <strong>Ticker:</strong> Símbolo del activo (ejemplo: MELI, AAPL, AL30)</li>
                  <li>• <strong>Cantidad:</strong> Número de unidades (ejemplo: 10 o 1250.50)</li>
                  <li>• <strong>Precio:</strong> Precio de compra en ARS (ejemplo: 17220 o 839.50)</li>
                </ul>
                <p className="text-slate-400 mt-2 text-xs">
                  Tip: Descargá el template para ver un ejemplo completo y editalo en Excel
                </p>
              </div>
            </div>

            {/* Trades Table */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50">
                      <th
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('fecha')}
                      >
                        <div className="flex items-center gap-1">
                          Fecha
                          {sortConfig.key === 'fecha' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('ticker')}
                      >
                        <div className="flex items-center gap-1">
                          Ticker
                          {sortConfig.key === 'ticker' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cantidad</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Precio</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Invertido</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {sortedTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3 text-slate-300 text-sm">
                          {new Date(trade.fecha).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-white font-mono">{trade.ticker}</span>
                        </td>
                        <td className="text-right px-4 py-3 text-slate-300 font-mono">
                          {formatNumber(trade.cantidad)}
                        </td>
                        <td className="text-right px-4 py-3 text-white font-mono font-medium">
                          {formatARS(trade.precioCompra)}
                        </td>
                        <td className="text-right px-4 py-3 text-slate-400 font-mono text-sm hidden sm:table-cell">
                          {formatARS(trade.cantidad * trade.precioCompra)}
                        </td>
                        <td className="text-right px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingTrade(trade);
                                setModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingTrade(trade);
                                setDeleteModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trades.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plus className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-slate-400 mb-2 font-medium">No hay trades registrados</p>
                    <p className="text-slate-500 text-sm mb-4">Empezá importando desde Google Sheets o agregando manualmente</p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => {
                          setEditingTrade(null);
                          setModalOpen(true);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-medium text-sm"
                      >
                        Agregar trade
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        onClick={importFromGoogleSheets}
                        className="text-blue-400 hover:text-blue-300 font-medium text-sm"
                      >
                        Importar desde Sheets
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-xs text-slate-500">
          <span>Datos: data912.com</span>
          <span>Portfolio Tracker v2.0</span>
        </div>
      </footer>

      {/* Modals */}
      <TradeModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTrade(null);
        }}
        onSave={handleSaveTrade}
        trade={editingTrade}
        tickers={tickers}
      />

      <DeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingTrade(null);
        }}
        onConfirm={handleDeleteTrade}
        tradeTicker={deletingTrade?.ticker}
      />
    </div>
  );
}
