import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, AlertCircle, Loader2, Activity, Zap, DollarSign, BarChart3 } from 'lucide-react';
import { data912 } from './utils/data912';
import { CONSTANTS, API_ENDPOINTS } from './utils/constants';
import { formatARS, formatUSD, formatPercent, formatNumber, formatDateTime } from './utils/formatters';
import { isBonoPesos, isBonoHardDollar, getAssetClass, adjustBondPrice, useBondPrices } from './hooks/useBondPrices';
import { parseARSNumber, parseDateDMY } from './utils/parsers';
import { useLocalStorage } from './hooks/useLocalStorage';
import DistributionChart from './components/DistributionChart';
import SummaryCard from './components/common/SummaryCard';

// Lazy load PositionDetailModal (large component)
const PositionDetailModal = lazy(() => import('./components/PositionDetailModal'));

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
      <p className="text-slate-400">Cargando...</p>
    </div>
  </div>
);

// ============================================
// PARSE UTILITIES
// ============================================

// ============================================
// IMPORTED HOOKS
// ============================================

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

          {(isBonoPesos(formData.ticker) || isBonoHardDollar(formData.ticker)) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-400 text-xs">
                {isBonoPesos(formData.ticker)
                  ? '💡 Bonos en pesos: ingresá el precio por cada $1 de VN (ej: 1.03)'
                  : '💡 Bonos HD: ingresá el precio por cada lámina de 100 USD VN (ej: 1155)'}
              </p>
            </div>
          )}

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

// ============================================
// ALL COMPONENTS IMPORTED/DEFINED ABOVE
// ============================================



// ============================================
// MAIN APP COMPONENT
// ============================================

export default function PortfolioTracker() {
  const [trades, setTrades] = useLocalStorage('portfolio-trades-v3', []);
  const [prices, setPrices] = useLocalStorage('portfolio-prices-v3', {});
  const [tickers, setTickers] = useState([]);
  const [mepRate, setMepRate] = useState(CONSTANTS.MEP_DEFAULT);
  const [isLoading, setIsLoading] = useState(false);
  const [isPricesLoading, setIsPricesLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastUpdateFull, setLastUpdateFull] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingTrade, setDeletingTrade] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [lastValidPrices, setLastValidPrices] = useState({});

// Fetch prices using data912 helper with auto-refresh
  const fetchPrices = useCallback(async () => {
    setIsPricesLoading(true);
    const priceMap = {};
    const tickerList = [];
    const unavailableTickers = [];

    try {
      // Fetch from /live/mep (main source - has bonds + cedears with MEP calc)
      const mepResponse = await fetch('https://data912.com/live/mep', {
        signal: AbortSignal.timeout(10000)
      });
      if (!mepResponse.ok) throw new Error('Failed to fetch MEP data');
      const mepData = await mepResponse.json();

      let avgMep = 0;
      let mepCount = 0;

      mepData.forEach(item => {
        const ticker = item.ticker;
        const assetClass = getAssetClass(ticker, item.panel);

        // Precio base de data912
        let rawPrice = item.ars_bid || item.mark || item.close || 0;

        // ⚡ AJUSTE CRÍTICO: Bonos en pesos vienen por $1000 VN, convertir a precio por $1 VN
        const adjustedPrice = adjustBondPrice(ticker, rawPrice);

// Price persistence: mantener último válido si el nuevo es 0 o null
        const isValidPrice = adjustedPrice > 0;
        const lastValid = lastValidPrices[ticker];
        const finalPrice = isValidPrice ? adjustedPrice : (lastValid?.precio || adjustedPrice);
        const finalRawPrice = isValidPrice ? rawPrice : (lastValid?.precioRaw || rawPrice);
        
        priceMap[ticker] = {
          precio: finalPrice,
          precioRaw: finalRawPrice,
          bid: item.ars_bid,
          ask: item.ars_ask,
          close: item.close,
          panel: item.panel,
          assetClass,
          pctChange: null,
          isBonoPesos: isBonoPesos(ticker),
          isBonoHD: isBonoHardDollar(ticker),
          isStale: !isValidPrice && lastValid // Marcar si el precio está desactualizado
        };

        tickerList.push({
          ticker,
          panel: item.panel,
          assetClass
        });

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
              pctChange: item.pct_change
            };

            tickerList.push({
              ticker,
              panel: 'arg_stock',
              assetClass
            });
          } else {
            // Update pct_change from this source
            priceMap[ticker].pctChange = item.pct_change;
            // Update price if newer and valid
            if (item.c && item.c > 0) {
              const lastValid = lastValidPrices[ticker];
              const shouldUpdate = !lastValid || (Date.now() - lastValid.timestamp > 300000); // 5 minutos
              
              if (shouldUpdate) {
                priceMap[ticker].precio = item.c;
                priceMap[ticker].close = item.c;
                
                // Actualizar último válido
                if (!lastValidPrices[ticker]) {
                  setLastValidPrices(prev => ({
                    ...prev,
                    [ticker]: {
                      precio: item.c,
                      precioRaw: item.c,
                      timestamp: Date.now()
                    }
                  }));
                }
              }
            }
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
            // Update price if newer and valid
            if (item.c && item.c > 0) {
              const lastValid = lastValidPrices[ticker];
              const shouldUpdate = !lastValid || (Date.now() - lastValid.timestamp > 300000); // 5 minutos
              
              if (shouldUpdate) {
                priceMap[ticker].precio = item.c;
                priceMap[ticker].close = item.c;
                
                // Actualizar último válido
                if (!lastValidPrices[ticker]) {
                  setLastValidPrices(prev => ({
                    ...prev,
                    [ticker]: {
                      precio: item.c,
                      precioRaw: item.c,
                      timestamp: Date.now()
                    }
                  }));
                }
              }
            }
          }
        });
      } catch (e) {
        console.warn('Could not fetch arg_cedears:', e);
      }

      // Fetch from /live/arg_bonds (peso bonds like TTD26, T15E7, etc.)
      try {
        const bondsResponse = await fetch('https://data912.com/live/arg_bonds', {
          signal: AbortSignal.timeout(10000)
        });
        if (!bondsResponse.ok) throw new Error('Failed to fetch arg_bonds');
        const bondsData = await bondsResponse.json();

        bondsData.forEach(item => {
          const ticker = item.symbol;
          
          // Skip D and C versions
          if (ticker.endsWith('D') || ticker.endsWith('C')) return;

          // Only process if not already in priceMap
          if (!priceMap[ticker]) {
            const rawPrice = item.c || item.px_ask || item.px_bid || 0;
            const assetClass = getAssetClass(ticker, 'bonds');
            const adjustedPrice = adjustBondPrice(ticker, rawPrice);

            priceMap[ticker] = {
              precio: adjustedPrice,
              precioRaw: rawPrice,
              bid: item.px_bid,
              ask: item.px_ask,
              close: item.c,
              panel: 'bonds',
              assetClass,
              pctChange: item.pct_change,
              isBonoPesos: isBonoPesos(ticker),
              isBonoHD: isBonoHardDollar(ticker)
            };

            tickerList.push({
              ticker,
              panel: 'bonds',
              assetClass
            });
          } else {
            // Update pct_change if available
            if (item.pct_change !== null && item.pct_change !== undefined) {
              priceMap[ticker].pctChange = item.pct_change;
            }
          }
        });
      } catch (e) {
        console.warn('Could not fetch arg_bonds:', e);
      }

const now = new Date();
      setPrices(priceMap);
      setTickers(tickerList.sort((a, b) => a.ticker.localeCompare(b.ticker)));
      setLastUpdate(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
      setLastUpdateFull(now.toLocaleDateString('es-AR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }));

} catch (error) {
      console.error('Error fetching prices:', error);
      const now = new Date();
      setLastUpdate(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' (error)');
      setLastUpdateFull(now.toLocaleDateString('es-AR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' (error)');
    } finally {
      setIsPricesLoading(false);
    }
  }, []); // Remove setPrices dependency to prevent infinite loop

  // Initial fetch
  useEffect(() => {
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Auto-refresh prices for positions using data912 helper (every 30s)
  useEffect(() => {
    if (!trades || trades.length === 0) return;

    const refreshPositionPrices = async () => {
      try {
        // Get unique tickers from trades
        const uniqueTickers = [...new Set(trades.map(t => t.ticker))];
        if (uniqueTickers.length === 0) return;

        // Batch fetch prices and daily returns
        const [batchPrices, batchReturns] = await Promise.all([
          data912.getBatchPrices(uniqueTickers),
          data912.getBatchDailyReturns(uniqueTickers)
        ]);

// Update price map with data912 results with price persistence
        setPrices(prevPrices => {
          const updated = { ...prevPrices };
          
          Object.keys(batchPrices).forEach(ticker => {
            const newPrice = batchPrices[ticker];
            
            if (updated[ticker]) {
              const currentPrice = updated[ticker];
              
              // Persistencia: si el nuevo precio es válido (> 0), usar ese
              // Si es 0 o inválido, mantener el anterior
              if (newPrice > 0) {
                const adjustedPrice = adjustBondPrice(ticker, newPrice);
                
                updated[ticker] = {
                  ...currentPrice,
                  precio: adjustedPrice,
                  precioRaw: newPrice,
                  pctChange: batchReturns[ticker] || currentPrice.pctChange,
                  lastUpdate: Date.now()
                };
                
                // Guardar en localStorage para persistencia
                try {
                  localStorage.setItem(`price_${ticker}`, JSON.stringify({
                    precio: adjustedPrice,
                    precioRaw: newPrice,
                    timestamp: Date.now()
                  }));
                } catch (e) {
                  // Ignorar errores de localStorage
                }
              }
              // Si newPrice es 0, no actualizamos - mantenemos el precio anterior
            }
          });
          
          return updated;
        });
      } catch (error) {
        console.error('Error refreshing position prices:', error);
      }
    };

    // Initial refresh
    refreshPositionPrices();

    // Set up 30s interval
    const interval = setInterval(refreshPositionPrices, 30000);
    return () => clearInterval(interval);
  }, [trades]);

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

  // Calculate positions (grouped trades) with daily P&L
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

      // Daily P&L calculations
      const dailyReturnPct = priceData?.pctChange || 0;
      const resultadoDiario = (dailyReturnPct / 100) * valuacionActual;
      const resultadoDiarioPct = dailyReturnPct;

      const assetClass = priceData?.assetClass || getAssetClass(pos.ticker, priceData?.panel);

      return {
        ...pos,
        precioPromedio,
        precioActual,
        valuacionActual,
        resultado,
        resultadoPct,
        resultadoDiario,
        resultadoDiarioPct,
        assetClass,
        pctChange: priceData?.pctChange,
        isBonoPesos: priceData?.isBonoPesos || isBonoPesos(pos.ticker),
        isBonoHD: priceData?.isBonoHD || isBonoHardDollar(pos.ticker),
        // USD calculations
        costoUSD: pos.costoTotal / mepRate,
        valuacionUSD: valuacionActual / mepRate,
        resultadoUSD: resultado / mepRate,
        resultadoDiarioUSD: resultadoDiario / mepRate
      };
    }).sort((a, b) => b.valuacionActual - a.valuacionActual);
  }, [trades, prices, mepRate]);

  // Portfolio totals with daily P&L
  const totals = useMemo(() => {
    const invertido = positions.reduce((sum, p) => sum + p.costoTotal, 0);
    const valuacion = positions.reduce((sum, p) => sum + p.valuacionActual, 0);
    const resultado = valuacion - invertido;
    const resultadoPct = invertido > 0 ? (resultado / invertido) * 100 : 0;
    const resultadoDiario = positions.reduce((sum, p) => sum + (p.resultadoDiario || 0), 0);
    const resultadoDiarioPct = invertido > 0 ? (resultadoDiario / invertido) * 100 : 0;

    return {
      invertido,
      valuacion,
      resultado,
      resultadoPct,
      resultadoDiario,
      resultadoDiarioPct,
      invertidoUSD: invertido / mepRate,
      valuacionUSD: valuacion / mepRate,
      resultadoUSD: resultado / mepRate,
      resultadoDiarioUSD: resultadoDiario / mepRate
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

  const handleOpenPositionDetail = (position) => {
    setSelectedPosition(position);
    setDetailModalOpen(true);
  };

  const handleClosePositionDetail = () => {
    setDetailModalOpen(false);
    setSelectedPosition(null);
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                <span className="text-sm text-slate-400">
                  MEP: <span className="text-emerald-400 font-mono font-medium">{formatARS(mepRate)}</span>
                </span>
                {lastUpdate && (
                  <span className="text-xs text-slate-500">
                    Actualizado: {lastUpdateFull || lastUpdate}
                  </span>
                )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
                title="Resultado Total"
                value={formatARS(totals.resultado)}
                subValue={formatPercent(totals.resultadoPct)}
                icon={totals.resultado >= 0 ? TrendingUp : TrendingDown}
                trend={totals.resultado}
                isLoading={isPricesLoading}
              />
            </div>

            {/* Distribution Chart + Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-1">
                <DistributionChart positions={positions} />
              </div>
              <div className="lg:col-span-2 bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border border-slate-700/50">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {positions.map((pos) => (
                      <React.Fragment key={pos.ticker}>
                        <tr
                          className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                          onClick={() => handleOpenPositionDetail(pos)}
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
                              : formatARS(pos.precioPromedio)
                            }
                          </td>
                          <td className="text-right px-4 py-3 text-white font-mono font-medium">
                            {isBonoPesos(pos.ticker) 
                              ? `$${pos.precioActual.toFixed(4)}` 
                              : formatARS(pos.precioActual)
                            }
                          </td>
                          <td className="text-right px-4 py-3 text-slate-400 font-mono text-sm hidden lg:table-cell">
                            {formatARS(pos.costoTotal)}
                          </td>
                          <td className="text-right px-4 py-3 text-white font-mono font-medium">
                            {formatARS(pos.valuacionActual)}
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
                              <span className="block text-xs opacity-80">
                                {formatPercent(pos.resultadoDiarioPct || 0)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                    {positions.length > 0 && (
                      <tr className="bg-slate-900/80 border-t-2 border-emerald-500/30">
                        <td className="px-4 py-4 text-left">
                          <span className="font-bold text-emerald-400 uppercase tracking-wide text-sm">TOTAL PORTFOLIO</span>
                        </td>
                        <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden sm:table-cell">
                          -
                        </td>
                        <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm hidden md:table-cell">
                          -
                        </td>
                        <td className="text-right px-4 py-4 text-slate-400 font-mono text-sm">
                          -
                        </td>
                        <td className="text-right px-4 py-4 text-white font-mono font-bold text-base hidden lg:table-cell">
                          {formatARS(totals.invertido)}
                        </td>
                        <td className="text-right px-4 py-4 text-white font-mono font-bold text-base">
                          {formatARS(totals.valuacion)}
                        </td>
                        <td className="text-right px-4 py-4 hidden xl:table-cell">
                          <div className={`font-mono font-bold text-base ${totals.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatARS(totals.resultado)}
                            <span className="block text-xs opacity-90 font-semibold">
                              {formatPercent(totals.resultadoPct)}
                            </span>
                          </div>
</td>
                        <td className="text-right px-4 py-4">
                          <div className={`font-mono font-bold text-base ${totals.resultadoDiario >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatARS(totals.resultadoDiario)}
                            <span className="block text-xs opacity-90 font-semibold">
                              {formatPercent(totals.resultadoDiarioPct)}
                            </span>
                          </div>
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
                  <li>• <strong>Bonos en pesos:</strong> Precio por cada $1 de VN (ejemplo: 1.03)</li>
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
                    {sortedTrades.map((trade) => {
                      const isBono = isBonoPesos(trade.ticker);
                      return (
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
                            {isBono ? `$${trade.precioCompra.toFixed(4)}` : formatARS(trade.precioCompra)}
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
                      );
                    })}
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
          <span>Portfolio Tracker v3.0 - Ajuste bonos ÷1000</span>
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

      <Suspense fallback={<LoadingFallback />}>
        <PositionDetailModal
          open={detailModalOpen}
          onClose={handleClosePositionDetail}
          position={selectedPosition}
          trades={trades}
        />
      </Suspense>
    </div>
  );
}
