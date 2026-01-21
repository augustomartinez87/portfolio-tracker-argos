import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, AlertCircle, Loader2, Activity, DollarSign, BarChart3, ArrowUp, ArrowDown, LogOut, LayoutDashboard, FileText, HelpCircle, Menu } from 'lucide-react';
import { data912 } from './utils/data912';
import { CONSTANTS, API_ENDPOINTS } from './utils/constants';
import { formatARS, formatUSD, formatPercent, formatNumber, formatDateTime } from './utils/formatters';
import { isBonoPesos, isBonoHardDollar, getAssetClass, adjustBondPrice, useBondPrices } from './hooks/useBondPrices';
import { parseARSNumber, parseDateDMY } from './utils/parsers';
import { useLocalStorage } from './hooks/useLocalStorage';
import DistributionChart from './components/DistributionChart';
import PortfolioEvolutionChart from './components/PortfolioEvolutionChart';
import SummaryCard from './components/common/SummaryCard';
import PositionsTable from './components/dashboard/PositionsTable';
import { TopPerformers } from './components/dashboard/TopPerformers';
import { RecentActivity } from './components/dashboard/RecentActivity';
import logo from './assets/logo.png';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error inesperado</h2>
            <p className="text-slate-400 mb-4">Hubo un problema al cargar la página.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    'BONO HARD DOLLAR': 'text-amber-400',
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
        className="w-full px-4 py-3 h-12 bg-slate-900 border border-slate-600 rounded-custom text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
      />
      {isOpen && filteredTickers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-slate-800 border border-slate-600 rounded-custom shadow-2xl"
        >
          {filteredTickers.map((ticker) => (
            <button
              key={ticker.ticker}
              onClick={() => handleSelect(ticker)}
              className="w-full px-4 py-3 h-12 text-left hover:bg-slate-700 active:bg-slate-600 transition-colors flex justify-between items-center border-b border-slate-700/50 last:border-0"
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
    tipo: 'compra',
    fecha: '',
    ticker: '',
    cantidad: '',
    precio: ''
  });

  useEffect(() => {
    if (trade) {
      setFormData({
        tipo: trade.tipo || 'compra',
        fecha: trade.fecha || '',
        ticker: trade.ticker || '',
        cantidad: Math.abs(trade.cantidad)?.toString() || '',
        precio: trade.precioCompra?.toString() || ''
      });
    } else {
      setFormData({
        tipo: 'compra',
        fecha: new Date().toISOString().split('T')[0],
        ticker: '',
        cantidad: '',
        precio: ''
      });
    }
  }, [trade, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cantidad = parseFloat(formData.cantidad) || 0;
    const isVenta = formData.tipo === 'venta';
    
    onSave({
      id: trade?.id || crypto.randomUUID(),
      fecha: formData.fecha,
      ticker: formData.ticker.toUpperCase(),
      cantidad: isVenta ? -cantidad : cantidad,
      precioCompra: parseFloat(formData.precio) || 0,
      tipo: formData.tipo
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
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700 active:scale-95">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({...formData, tipo: 'compra'})}
                className={`py-3 px-4 h-12 rounded-custom font-medium text-sm transition-all active:scale-95 ${
                  formData.tipo === 'compra'
                    ? 'bg-emerald-600 text-white border-2 border-emerald-500'
                    : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-600'
                }`}
              >
                Compra
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, tipo: 'venta'})}
                className={`py-3 px-4 h-12 rounded-custom font-medium text-sm transition-all active:scale-95 ${
                  formData.tipo === 'venta'
                    ? 'bg-red-600 text-white border-2 border-red-500'
                    : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-600'
                }`}
              >
                Venta
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              className="w-full px-4 py-3 h-12 bg-slate-900 border border-slate-600 rounded-custom text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ticker</label>
            <TickerAutocomplete
              value={formData.ticker}
              onChange={(ticker) => setFormData({...formData, ticker})}
              tickers={tickers}
              disabled={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={formData.cantidad}
                onChange={(e) => setFormData({...formData, cantidad: e.target.value})}
                className="w-full px-4 py-3 h-12 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Precio (ARS)</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={formData.precio}
                onChange={(e) => setFormData({...formData, precio: e.target.value})}
                className="w-full px-4 py-3 h-12 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {(isBonoPesos(formData.ticker) || isBonoHardDollar(formData.ticker)) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-custom p-3">
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
              className="flex-1 px-4 py-3 h-12 bg-slate-700 text-white rounded-custom hover:bg-slate-600 transition-colors font-medium active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-3 h-12 font-semibold rounded-custom transition-all active:scale-95 ${
                formData.tipo === 'venta'
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-primary text-white hover:bg-primary-light'
              }`}
            >
              {trade ? 'Guardar' : (formData.tipo === 'venta' ? 'Registrar Venta' : 'Agregar')}
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

export default function ArgosCapital() {
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
  const [positionsSort, setPositionsSort] = useState({ key: 'valuacionActual', direction: 'desc' });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [lastValidPrices, setLastValidPrices] = useState({});
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

        // AJUSTE CRÍTICO para bonos:
        // - Bonos pesos (T15E7, TTD26): dividir por 100
        // - Bonos HD (AE38, AL30): dividir por 100
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
          if (!ticker) return;
          
          // Skip dollar versions (pattern: XXXD where XXX is a known ticker)
          // Examples: ALUAD, GGALD, PAMPD - but NOT YPFD (which is the main ticker)
          const knownDollarSuffixes = ['ALUAD', 'GGALD', 'PAMPD', 'CEPAD', 'SUPVD', 'TXARD', 'BBARD', 'BYMAD', 
            'COMED', 'CRESD', 'EDND', 'IRSAD', 'LOMAD', 'METRD', 'TECOD', 'TGSUD', 'TRAND', 'VALOD', 'CEPUD',
            'ECOGD', 'TGN4D', 'YPFDD']; // YPFDD is dollar version, YPFD is main
          if (knownDollarSuffixes.includes(ticker)) return;
          
          // Also skip any ticker ending in .D
          if (ticker.endsWith('.D')) return;

          const assetClass = getAssetClass(ticker, null, true);

// Only add if not already in priceMap or update with pct_change
          if (!priceMap[ticker]) {
            const rawPrice = item.c || item.px_ask || item.px_bid || 0;
            const adjustedPrice = adjustBondPrice(ticker, rawPrice);
            
            priceMap[ticker] = {
              precio: adjustedPrice,
              precioRaw: rawPrice,
              bid: item.px_bid,
              ask: item.px_ask,
              close: item.c,
              panel: 'arg_stock',
              assetClass,
              pctChange: item.pct_change,
              isBonoPesos: isBonoPesos(ticker),
              isBonoHD: isBonoHardDollar(ticker)
            };

            tickerList.push({
              ticker,
              panel: 'arg_stock',
              assetClass
            });
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
          if (!ticker) return;
          
          // Skip dollar (D) and cable (C) versions
          // These have pattern: BASEC or BASED where BASE is 3+ chars ending in letter
          // Examples to skip: AAPLC, AAPLD, GOOGLD, MSFTC
          // Examples to keep: GOOGL, AMD, KO, C (Citigroup)
          const isDollarOrCable = ticker.length > 3 && 
            (ticker.endsWith('D') || ticker.endsWith('C')) && 
            /[A-Z]$/.test(ticker.slice(-2, -1)); // second-to-last is a letter
          
          if (isDollarOrCable) return;

// Add or update from arg_cedears
          if (!priceMap[ticker]) {
            // Add new CEDEAR if not already in priceMap
            const rawPrice = item.c || item.px_ask || item.px_bid || 0;
            const assetClass = 'CEDEAR';
            
            priceMap[ticker] = {
              precio: rawPrice,
              precioRaw: rawPrice,
              bid: item.px_bid,
              ask: item.px_ask,
              close: item.c,
              panel: 'cedear',
              assetClass,
              pctChange: item.pct_change,
              isBonoPesos: false,
              isBonoHD: false
            };

            tickerList.push({
              ticker,
              panel: 'cedear',
              assetClass
            });
          } else {
            // Update pct_change for existing tickers
            priceMap[ticker].pctChange = item.pct_change;
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
          if (!ticker) return;
          
          // Skip dollar (D) and cable (C) versions
          // Pattern: XXXX with D or C suffix where base is a bond ticker
          // Examples to skip: AL30D, AL30C, AE38D, TTD26D (if exists)
          // Examples to keep: AL30, AE38, TTD26, T15E7
          const len = ticker.length;
          if (len > 3 && (ticker.endsWith('D') || ticker.endsWith('C'))) {
            // Check if it's a bond version suffix (previous char is digit for bonds like AL30D)
            const prevChar = ticker.charAt(len - 2);
            if (/[0-9]/.test(prevChar)) {
              return; // Skip versions like AL30D, AE38C
            }
          }

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
  }, [fetchPrices]); // Run when fetchPrices changes or component mounts

  // Auto-refresh prices for positions using data912 helper (every 30s)
  useEffect(() => {
    if (!trades || trades.length === 0) return;

    const refreshPositionPrices = async () => {
      try {
        // Limpiar cache de bonos para forzar fetch nuevo
        data912.clearBondCache?.();

        // Get unique tickers from trades (more reliable than prices state)
        const uniqueTickers = [...new Set(trades.map(t => t.ticker))];
        const tickerData = uniqueTickers.map(ticker => ({
          ticker,
          assetClass: getAssetClass(ticker, null)
        }));
        
        if (tickerData.length === 0) return;

        // Batch fetch prices and daily returns
        const [batchPrices, batchReturns] = await Promise.all([
          data912.getBatchPrices(tickerData),
          data912.getBatchDailyReturns(tickerData)
        ]);
        
        // Update price map with adjusted prices
        setPrices(prevPrices => {
          const updated = { ...prevPrices };
          
          Object.keys(batchPrices).forEach(ticker => {
            const newPrice = batchPrices[ticker];
            const adjustedPrice = adjustBondPrice(ticker, newPrice);
            
            updated[ticker] = {
              ...updated[ticker],
              precio: adjustedPrice,
              precioRaw: newPrice,
              pctChange: batchReturns[ticker] ?? updated[ticker]?.pctChange,
              lastUpdate: Date.now(),
              assetClass: updated[ticker]?.assetClass || getAssetClass(ticker, null),
              isBonoPesos: isBonoPesos(ticker),
              isBonoHD: isBonoHardDollar(ticker)
            };
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

  // Close format help tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFormatHelp && !event.target.closest('.format-help-tooltip')) {
        setShowFormatHelp(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFormatHelp]);

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
      
      const cantidad = trade.cantidad || 0;
      grouped[trade.ticker].cantidadTotal += cantidad;
      
      // Solo sumar al costo en compras (cantidad positiva)
      // Las ventas no afectan el costo base (método FIFO simple)
      if (cantidad > 0) {
        grouped[trade.ticker].costoTotal += cantidad * trade.precioCompra;
      }
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
    if (!Array.isArray(trades) || trades.length === 0) return [];
    const sorted = [...trades].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'fecha') {
        aVal = aVal ? new Date(aVal) : new Date();
        bVal = bVal ? new Date(bVal) : new Date();
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
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Argos Capital" className="w-8 h-8" />
            <h1 className="text-lg font-bold text-white">Argos Capital</h1>
          </div>
          <button
            onClick={fetchPrices}
            disabled={isPricesLoading}
            className="p-3 h-12 w-12 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all border border-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${isPricesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/50 fixed h-screen left-0 top-0 z-40 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
          <h1 className={`text-xl font-bold text-white tracking-tight flex items-center gap-3 transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <img src={logo} alt="Argos Capital" className="w-8 h-8 flex-shrink-0" />
            Argos Capital
          </h1>
          <img src={logo} alt="Argos Capital" className={`w-8 h-8 flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`} />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all active:scale-95"
            title="Menú"
          >
            <Menu className="w-5 h-5 flex-shrink-0" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center rounded-custom font-medium text-sm transition-all active:scale-95 ${sidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center px-0 py-3 h-12'} ${
              activeTab === 'dashboard'
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Dashboard"
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`w-full flex items-center rounded-custom font-medium text-sm transition-all active:scale-95 ${sidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center px-0 py-3 h-12'} ${
              activeTab === 'trades'
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Trades"
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Trades</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/50 space-y-2">
          <button
            onClick={fetchPrices}
            disabled={isPricesLoading}
            className={`w-full flex items-center ${sidebarOpen ? 'justify-center gap-2' : 'justify-center'} px-4 py-3 h-12 bg-slate-800 text-slate-300 rounded-custom hover:bg-slate-700 hover:text-white transition-all border border-slate-700 text-sm font-medium active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isPricesLoading ? 'animate-spin' : ''}`} />
            <span className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Actualizar</span>
          </button>
          <button
            onClick={() => {}}
            className={`w-full flex items-center ${sidebarOpen ? 'justify-center gap-2' : 'justify-center'} px-4 py-3 h-12 bg-slate-800/50 text-slate-400 rounded-custom hover:bg-slate-700 hover:text-white transition-all border border-slate-700/50 text-sm font-medium active:scale-95`}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Cerrar sesión</span>
          </button>
          {lastUpdate && sidebarOpen && (
            <p className="text-xs text-slate-500 mt-3 text-center transition-all duration-300">
              Actualizado: {lastUpdateFull || lastUpdate}
            </p>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/50 px-2 py-2 safe-area-inset-bottom">
        <nav className="flex justify-around">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-6 py-3 rounded-xl transition-all active:scale-95 min-h-[56px] min-w-[80px] ${
              activeTab === 'dashboard'
                ? 'text-emerald-400 bg-emerald-500/15'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs font-medium mt-0.5">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`flex flex-col items-center gap-1 px-6 py-3 rounded-xl transition-all active:scale-95 min-h-[56px] min-w-[80px] ${
              activeTab === 'trades'
                ? 'text-emerald-400 bg-emerald-500/15'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-6 h-6" />
            <span className="text-xs font-medium mt-0.5">Trades</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <main className={`flex-1 p-3 lg:p-4 pb-24 lg:pb-24 mt-14 lg:mt-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {activeTab === 'dashboard' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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

            {/* Resumen - 4 cards */}
            <div className="mb-4">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom p-3 border border-slate-700/50 shadow-xl backdrop-blur-sm">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 text-center">
                    <p className="text-slate-400 text-[10px] mb-0.5">Posiciones</p>
                    <p className="text-white font-mono text-base font-semibold">{positions.length}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 text-center">
                    <p className="text-slate-400 text-[10px] mb-0.5">Trades</p>
                    <p className="text-white font-mono text-base font-semibold">{trades.length}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 text-center">
                    <p className="text-slate-400 text-[10px] mb-0.5">Dólar MEP</p>
                    <p className="text-white font-mono text-base font-semibold">{formatARS(mepRate)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 text-center">
                    <p className="text-slate-400 text-[10px] mb-0.5">Data</p>
                    <p className="text-slate-300 font-mono text-xs">data912.com</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution + Evolution Chart side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom p-4 border border-slate-700/50 shadow-xl backdrop-blur-sm min-h-[350px]">
                <DistributionChart positions={positions} />
              </div>
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom border border-slate-700/50 shadow-xl backdrop-blur-sm">
                <PortfolioEvolutionChart trades={trades} prices={prices} />
              </div>
            </div>

            {/* Top Performers + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div className="lg:col-span-2">
                <TopPerformers positions={positions} prices={prices} maxItems={3} />
              </div>
              <div className="lg:col-span-1">
                <RecentActivity trades={trades} maxItems={3} />
              </div>
            </div>

            {/* Positions Table */}
            <div className="mb-20">
              <PositionsTable 
                positions={positions} 
                onRowClick={handleOpenPositionDetail}
                prices={prices}
                mepRate={mepRate}
                sortConfig={positionsSort}
                onSortChange={setPositionsSort}
              />
            </div>

             {/* Footer - Desktop Only */}
            <div className={`hidden lg:block fixed bottom-0 right-0 bg-slate-950/90 backdrop-blur-sm border-t border-slate-800/50 py-2 px-6 transition-all duration-300 ${sidebarOpen ? 'left-64' : 'left-16'}`}>
              <p className="text-slate-500 text-xs text-center">Argos Capital v3.0</p>
            </div>
          </>
        ) : (
        <>
            {/* Trades Tab */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <button
                  onClick={() => {
                    setEditingTrade(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 h-12 bg-primary text-white rounded-custom hover:bg-primary-light transition-all font-semibold shadow-lg shadow-primary/25 text-sm sm:text-base active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nuevo Trade</span>
                  <span className="sm:hidden">Nuevo</span>
                </button>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 h-12 bg-purple-600 text-white rounded-custom hover:bg-purple-500 transition-all font-semibold shadow-lg shadow-purple-600/25 text-sm sm:text-base active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Descargar Template Excel</span>
                  <span className="sm:hidden">Template</span>
                </button>
                <label className="flex items-center justify-center gap-2 px-4 py-3.5 h-12 bg-primary text-white rounded-custom hover:bg-primary-light transition-all font-semibold shadow-lg shadow-primary/25 cursor-pointer text-sm sm:text-base active:scale-95 disabled:opacity-50">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={importFromCSV}
                    disabled={isLoading}
                    className="hidden"
                  />
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  <span className="hidden sm:inline">Importar CSV/Excel</span>
                  <span className="sm:hidden">Importar</span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowFormatHelp(!showFormatHelp)}
                    className="flex items-center justify-center w-12 h-12 bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 hover:text-white transition-all border border-slate-600 active:scale-95"
                    title="Ayuda formato"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                  {showFormatHelp && (
                    <div className="format-help-tooltip absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 bg-gradient-to-br from-slate-800 to-slate-900 rounded-custom p-4 border border-slate-700 shadow-xl">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-blue-300 font-medium text-sm sm:text-base">📋 Formato CSV/Excel:</p>
                        <button 
                          onClick={() => setShowFormatHelp(false)}
                          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 active:scale-95 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <ul className="text-slate-300 space-y-1 text-xs sm:text-sm ml-4">
                        <li>• <strong>Fecha:</strong> DD/MM/YYYY (ej: 23/12/2024)</li>
                        <li>• <strong>Ticker:</strong> Símbolo del activo (ej: MELI, AAPL, AL30)</li>
                        <li>• <strong>Cantidad:</strong> Número de unidades (ej: 10 o 1250.50)</li>
                        <li>• <strong>Precio:</strong> Precio de compra en ARS (ej: 17220 o 839.50)</li>
                        <li>• <strong>Bonos pesos:</strong> Precio por $1 VN (ej: 1.03)</li>
                      </ul>
                      <p className="text-slate-400 mt-2 text-xs">
                        Tip: Descargá el template para ver un ejemplo completo
                      </p>
                    </div>
                  )}
                </div>
              </div>
               {importStatus && (
                <span className={`flex items-center px-4 py-2 rounded-custom text-sm font-medium ${
                  importStatus.includes('✓') ? 'bg-success/20 text-success' :
                  importStatus.includes('Error') ? 'bg-danger/20 text-danger' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {importStatus}
                </span>
              )}
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
                    <p className="text-slate-500 text-sm mb-4">Empezá importando un archivo CSV o agregando manualmente</p>
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
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

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
    </ErrorBoundary>
  );
}
