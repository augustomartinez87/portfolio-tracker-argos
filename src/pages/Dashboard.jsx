import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, AlertCircle, Loader2, Activity, DollarSign, BarChart3, ArrowUp, ArrowDown, LogOut, LayoutDashboard, FileText, HelpCircle, Menu, PieChart, Search, List } from 'lucide-react';
import { data912 } from '../utils/data912';
import { CONSTANTS, API_ENDPOINTS } from '../utils/constants';
import { formatARS, formatUSD, formatPercent, formatNumber, formatDateTime } from '../utils/formatters';
import { isBonoPesos, isBonoHardDollar, getAssetClass, adjustBondPrice, useBondPrices } from '../hooks/useBondPrices';
import { parseARSNumber, parseDateDMY } from '../utils/parsers';
import DistributionChart from '../components/DistributionChart';
import SummaryCard from '../components/common/SummaryCard';
import PositionsTable from '../components/dashboard/PositionsTable';
import ColumnSelector from '../components/dashboard/ColumnSelector';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { PortfolioSelector } from '../components/PortfolioSelector';
import { tradeService } from '../services/tradeService';
import logo from '../assets/logo.png';

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
    console.error('Component stack:', errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error inesperado</h2>
            <p className="text-slate-400 mb-4">{this.state.error?.message || 'Hubo un problema al cargar la página.'}</p>
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
const PositionDetailModal = lazy(() => import('../components/PositionDetailModal'));

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

    // Validación de inputs numéricos
    const cantidad = parseFloat(formData.cantidad);
    const precio = parseFloat(formData.precio);

    if (!formData.fecha) {
      alert('La fecha es requerida');
      return;
    }

    if (!formData.ticker || formData.ticker.trim() === '') {
      alert('El ticker es requerido');
      return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
      alert('La cantidad debe ser un número mayor a 0');
      return;
    }

    if (isNaN(precio) || precio <= 0) {
      alert('El precio debe ser un número mayor a 0');
      return;
    }

    const isVenta = formData.tipo === 'venta';

    onSave({
      id: trade?.id || crypto.randomUUID(),
      fecha: formData.fecha,
      ticker: formData.ticker.toUpperCase().trim(),
      cantidad: isVenta ? -cantidad : cantidad,
      precioCompra: precio,
      tipo: formData.tipo
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background-secondary rounded-xl p-6 w-full max-w-md border border-border-primary shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-text-primary">
            {trade ? 'Editar transacción' : 'Nueva transacción'}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-background-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({...formData, tipo: 'compra'})}
                className={`py-2.5 px-3 h-10 rounded-lg font-medium text-sm transition-all active:scale-95 ${
                  formData.tipo === 'compra'
                    ? 'bg-success text-white'
                    : 'bg-background-tertiary text-text-secondary border border-border-primary hover:border-text-tertiary'
                }`}
              >
                Compra
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, tipo: 'venta'})}
                className={`py-2.5 px-3 h-10 rounded-lg font-medium text-sm transition-all active:scale-95 ${
                  formData.tipo === 'venta'
                    ? 'bg-danger text-white'
                    : 'bg-background-tertiary text-text-secondary border border-border-primary hover:border-text-tertiary'
                }`}
              >
                Venta
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Fecha</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Ticker</label>
            <TickerAutocomplete
              value={formData.ticker}
              onChange={(ticker) => setFormData({...formData, ticker})}
              tickers={tickers}
              disabled={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Cantidad</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={formData.cantidad}
                onChange={(e) => setFormData({...formData, cantidad: e.target.value})}
                className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Precio (ARS)</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={formData.precio}
                onChange={(e) => setFormData({...formData, precio: e.target.value})}
                className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {(isBonoPesos(formData.ticker) || isBonoHardDollar(formData.ticker)) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-400 text-xs">
                {isBonoPesos(formData.ticker)
                  ? 'Bonos en pesos: ingresá el precio por cada $1 de VN (ej: 1.03)'
                  : 'Bonos HD: ingresá el precio por cada lamina de 100 USD VN (ej: 1155)'}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2.5 h-10 bg-background-tertiary text-text-secondary rounded-lg hover:bg-border-primary transition-colors font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 px-3 py-2.5 h-10 font-medium rounded-lg transition-all active:scale-95 text-sm ${
                formData.tipo === 'venta'
                  ? 'bg-danger text-white hover:bg-danger/90'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {trade ? 'Guardar' : (formData.tipo === 'venta' ? 'Registrar' : 'Agregar')}
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background-secondary rounded-xl p-6 w-full max-w-sm border border-border-primary shadow-xl">
        <div className="text-center">
          <div className="w-12 h-12 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-danger" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Eliminar transacción</h3>
          <p className="text-text-tertiary mb-6">
            ¿Eliminar esta transacción de <span className="text-text-primary font-semibold font-mono">{tradeTicker}</span>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2.5 h-10 bg-background-tertiary text-text-secondary rounded-lg hover:bg-border-primary transition-colors font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-3 py-2.5 h-10 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors font-medium text-sm"
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
// MAIN DASHBOARD COMPONENT
// ============================================

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { currentPortfolio } = usePortfolio();
  const [trades, setTrades] = useState([]);
  const [prices, setPrices] = useState({});
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
  const [tradesLoading, setTradesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnSettings, setColumnSettings] = useState({
    showPPC: true,
    showInvertido: true,
    showDiario: true,
    showDiarioPct: true,
    density: 'compact'
  });

  // Load trades from Supabase - extracted as useCallback so it can be called from other places
  const loadTrades = useCallback(async () => {
    if (!currentPortfolio || !user) {
      setTrades([]);
      return;
    }
    try {
      setTradesLoading(true);
      const data = await tradeService.getTrades(currentPortfolio.id);
      setTrades(data || []);
    } catch (error) {
      console.error('Error loading trades:', error);
      setTrades([]);
    } finally {
      setTradesLoading(false);
    }
  }, [currentPortfolio, user]);

  // Load trades when portfolio changes
  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  // Fetch prices using data912 helper with auto-refresh
  const fetchPrices = useCallback(async () => {
    setIsPricesLoading(true);
    const priceMap = {};
    const tickerList = [];

    try {
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

        let rawPrice = item.ars_bid || item.mark || item.close || 0;
        const adjustedPrice = adjustBondPrice(ticker, rawPrice);

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
          isStale: !isValidPrice && lastValid
        };

        tickerList.push({
          ticker,
          panel: item.panel,
          assetClass
        });

        if (item.mark > 1400 && item.mark < 1600 && item.panel === 'cedear') {
          avgMep += item.mark;
          mepCount++;
        }
      });

      if (mepCount > 0) {
        setMepRate(avgMep / mepCount);
      }

      // Fetch stocks, cedears y bonds EN PARALELO para mejor performance
      const [stocksResult, cedearsResult, bondsResult] = await Promise.allSettled([
        fetch('https://data912.com/live/arg_stocks', { signal: AbortSignal.timeout(10000) })
          .then(r => r.ok ? r.json() : Promise.reject('Failed')),
        fetch('https://data912.com/live/arg_cedears', { signal: AbortSignal.timeout(10000) })
          .then(r => r.ok ? r.json() : Promise.reject('Failed')),
        fetch('https://data912.com/live/arg_bonds', { signal: AbortSignal.timeout(10000) })
          .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      ]);

      // Procesar arg_stocks
      if (stocksResult.status === 'fulfilled') {
        stocksResult.value.forEach(item => {
          const ticker = item.symbol;
          if (!ticker) return;

          const knownDollarSuffixes = ['ALUAD', 'GGALD', 'PAMPD', 'CEPAD', 'SUPVD', 'TXARD', 'BBARD', 'BYMAD',
            'COMED', 'CRESD', 'EDND', 'IRSAD', 'LOMAD', 'METRD', 'TECOD', 'TGSUD', 'TRAND', 'VALOD', 'CEPUD',
            'ECOGD', 'TGN4D', 'YPFDD'];
          if (knownDollarSuffixes.includes(ticker)) return;
          if (ticker.endsWith('.D')) return;

          const assetClass = getAssetClass(ticker, null, true);

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

            tickerList.push({ ticker, panel: 'arg_stock', assetClass });
          } else {
            priceMap[ticker].pctChange = item.pct_change;
          }
        });
      } else {
        console.warn('Could not fetch arg_stocks:', stocksResult.reason);
      }

      // Procesar cedears
      if (cedearsResult.status === 'fulfilled') {
        cedearsResult.value.forEach(item => {
          const ticker = item.symbol;
          if (!ticker) return;

          const isDollarOrCable = ticker.length > 3 &&
            (ticker.endsWith('D') || ticker.endsWith('C')) &&
            /[A-Z]$/.test(ticker.slice(-2, -1));
          if (isDollarOrCable) return;

          if (!priceMap[ticker]) {
            const rawPrice = item.c || item.px_ask || item.px_bid || 0;

            priceMap[ticker] = {
              precio: rawPrice,
              precioRaw: rawPrice,
              bid: item.px_bid,
              ask: item.px_ask,
              close: item.c,
              panel: 'cedear',
              assetClass: 'CEDEAR',
              pctChange: item.pct_change,
              isBonoPesos: false,
              isBonoHD: false
            };

            tickerList.push({ ticker, panel: 'cedear', assetClass: 'CEDEAR' });
          } else {
            priceMap[ticker].pctChange = item.pct_change;
          }
        });
      } else {
        console.warn('Could not fetch arg_cedears:', cedearsResult.reason);
      }

      // Procesar bonds
      if (bondsResult.status === 'fulfilled') {
        bondsResult.value.forEach(item => {
          const ticker = item.symbol;
          if (!ticker) return;

          const len = ticker.length;
          if (len > 3 && (ticker.endsWith('D') || ticker.endsWith('C'))) {
            const prevChar = ticker.charAt(len - 2);
            if (/[0-9]/.test(prevChar)) return;
          }

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

            tickerList.push({ ticker, panel: 'bonds', assetClass });
          } else {
            if (item.pct_change !== null && item.pct_change !== undefined) {
              priceMap[ticker].pctChange = item.pct_change;
            }
          }
        });
      } else {
        console.warn('Could not fetch arg_bonds:', bondsResult.reason);
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
  }, [lastValidPrices]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  useEffect(() => {
    if (!trades || trades.length === 0) return;

    // Flag para evitar actualizar state después del unmount
    let isMounted = true;

    const refreshPositionPrices = async () => {
      try {
        data912.clearBondCache?.();

        const uniqueTickers = [...new Set(trades.map(t => t.ticker))];
        const tickerData = uniqueTickers.map(ticker => ({
          ticker,
          assetClass: getAssetClass(ticker, null)
        }));

        if (tickerData.length === 0) return;

        const [batchPrices, batchReturns] = await Promise.all([
          data912.getBatchPrices(tickerData),
          data912.getBatchDailyReturns(tickerData)
        ]);

        // Solo actualizar si el componente sigue montado
        if (!isMounted) return;

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

    refreshPositionPrices();
    const interval = setInterval(refreshPositionPrices, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [trades]);

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

  const importFromCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!currentPortfolio?.id) {
      setImportStatus('Error: Selecciona un portfolio primero');
      setTimeout(() => setImportStatus(null), 3000);
      event.target.value = null;
      return;
    }

    setIsLoading(true);
    setImportStatus('Importando...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').slice(1);
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
              ticker: ticker.trim().toUpperCase(),
              quantity: parsedCantidad,
              price: parsedPrecio,
              trade_date: parsedDate,
              trade_type: 'buy',
              total_amount: parsedCantidad * parsedPrecio,
              currency: 'ARS'
            });
          }
        });

        if (newTrades.length > 0) {
          let savedCount = 0;
          let errorCount = 0;
          let lastError = null;

          for (const trade of newTrades) {
            try {
              await tradeService.createTrade(
                currentPortfolio.id,
                user.id,
                trade
              );
              savedCount++;
            } catch (err) {
              console.error('Error saving trade:', trade.ticker, err);
              lastError = err;
              errorCount++;
            }
          }

          if (savedCount > 0) {
            setImportStatus(`✓ ${savedCount} transacciones importadas${errorCount > 0 ? ` (${errorCount} fallidas: ${lastError?.message || 'error'})` : ''}`);
            loadTrades();
            setTimeout(() => setImportStatus(null), 5000);
          } else {
            setImportStatus(`Error al guardar transacciones: ${lastError?.message || 'Error desconocido'}`);
            setTimeout(() => setImportStatus(null), 5000);
          }
        } else {
          setImportStatus('No se encontraron transacciones válidas');
          setTimeout(() => setImportStatus(null), 3000);
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        setImportStatus('Error al importar archivo');
        setTimeout(() => setImportStatus(null), 3000);
      } finally {
        setIsLoading(false);
        event.target.value = null;
      }
    };

    reader.onerror = () => {
      setImportStatus('Error al leer archivo');
      setTimeout(() => setImportStatus(null), 3000);
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFormatHelp && !event.target.closest('.format-help-tooltip')) {
        setShowFormatHelp(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFormatHelp]);

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

      // Use Supabase field names (quantity, price) instead of legacy names
      const cantidad = trade.quantity || trade.cantidad || 0;
      const precio = trade.price || trade.precioCompra || 0;
      grouped[trade.ticker].cantidadTotal += cantidad;

      if (cantidad > 0) {
        grouped[trade.ticker].costoTotal += cantidad * precio;
      }
    });

    return Object.values(grouped).map(pos => {
      const priceData = prices[pos.ticker];
      const precioActual = priceData?.precio || 0;
      const precioPromedio = pos.cantidadTotal > 0 ? pos.costoTotal / pos.cantidadTotal : 0;
      const valuacionActual = pos.cantidadTotal * precioActual;
      const resultado = valuacionActual - pos.costoTotal;
      const resultadoPct = pos.costoTotal > 0 ? (resultado / pos.costoTotal) * 100 : 0;

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
        // Validar mepRate antes de dividir para evitar NaN/Infinity
        costoUSD: mepRate > 0 ? pos.costoTotal / mepRate : 0,
        valuacionUSD: mepRate > 0 ? valuacionActual / mepRate : 0,
        resultadoUSD: mepRate > 0 ? resultado / mepRate : 0,
        resultadoDiarioUSD: mepRate > 0 ? resultadoDiario / mepRate : 0
      };
    }).sort((a, b) => b.valuacionActual - a.valuacionActual);
  }, [trades, prices, mepRate]);

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
      // Validar mepRate antes de dividir para evitar NaN/Infinity
      invertidoUSD: mepRate > 0 ? invertido / mepRate : 0,
      valuacionUSD: mepRate > 0 ? valuacion / mepRate : 0,
      resultadoUSD: mepRate > 0 ? resultado / mepRate : 0,
      resultadoDiarioUSD: mepRate > 0 ? resultadoDiario / mepRate : 0
    };
  }, [positions, mepRate]);

  const sortedTrades = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return [];

    // Map Supabase fields to UI fields
    const mappedTrades = trades.map(trade => ({
      ...trade,
      fecha: trade.trade_date,
      cantidad: trade.quantity,
      precioCompra: trade.price,
      tipo: trade.trade_type === 'buy' ? 'compra' : 'venta'
    }));

    const sorted = [...mappedTrades].sort((a, b) => {
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

  const handleSaveTrade = async (trade) => {
    if (!currentPortfolio || !user) return;

    try {
      if (editingTrade) {
        await tradeService.updateTrade(trade.id, {
          ticker: trade.ticker,
          trade_type: trade.tipo === 'compra' ? 'buy' : 'sell',
          quantity: Math.abs(trade.cantidad),
          price: trade.precioCompra,
          total_amount: Math.abs(trade.cantidad) * trade.precioCompra,
          currency: 'ARS',
          trade_date: trade.fecha
        });
      } else {
        await tradeService.createTrade(currentPortfolio.id, user.id, {
          ticker: trade.ticker,
          trade_type: trade.tipo === 'compra' ? 'buy' : 'sell',
          quantity: Math.abs(trade.cantidad),
          price: trade.precioCompra,
          total_amount: Math.abs(trade.cantidad) * trade.precioCompra,
          currency: 'ARS',
          trade_date: trade.fecha
        });
      }
      
      const updatedTrades = await tradeService.getTrades(currentPortfolio.id);
      setTrades(updatedTrades || []);
      setModalOpen(false);
      setEditingTrade(null);
    } catch (error) {
      console.error('Error saving trade:', error);
      alert('Error al guardar el trade: ' + error.message);
    }
  };

  const handleDeleteTrade = async () => {
    if (!deletingTrade) return;

    try {
      await tradeService.deleteTrade(deletingTrade.id);
      const updatedTrades = await tradeService.getTrades(currentPortfolio.id);
      setTrades(updatedTrades || []);
      setDeleteModalOpen(false);
      setDeletingTrade(null);
    } catch (error) {
      console.error('Error deleting trade:', error);
      alert('Error al eliminar el trade: ' + error.message);
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

  if (tradesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!currentPortfolio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">No tienes portfolios creados.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background-primary flex">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PortfolioSelector />
            <img src={logo} alt="Argos Capital" className="w-8 h-8 ml-2" />
            <h1 className="text-lg font-bold text-text-primary">Argos Capital</h1>
          </div>
          <button
            onClick={fetchPrices}
            disabled={isPricesLoading}
            className="p-3 h-12 w-12 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${isPricesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex bg-background-secondary border-r border-border-primary fixed h-screen left-0 top-0 z-40 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="p-3 border-b border-border-primary flex items-center justify-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-background-tertiary transition-colors"
            title={sidebarOpen ? "Contraer menú" : "Expandir menú"}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center rounded-lg font-medium text-sm transition-all active:scale-95 ${sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5 h-10'} ${
              activeTab === 'dashboard'
                ? 'bg-background-tertiary text-text-primary border-l-2 border-success'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
            }`}
            title={sidebarOpen ? "Posiciones" : undefined}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Posiciones</span>
          </button>
          <button
            onClick={() => setActiveTab('graficos')}
            className={`w-full flex items-center rounded-lg font-medium text-sm transition-all active:scale-95 ${sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5 h-10'} ${
              activeTab === 'graficos'
                ? 'bg-background-tertiary text-text-primary border-l-2 border-success'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
            }`}
            title={sidebarOpen ? "Gráficos" : undefined}
          >
            <PieChart className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Gráficos</span>
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`w-full flex items-center rounded-lg font-medium text-sm transition-all active:scale-95 ${sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5 h-10'} ${
              activeTab === 'trades'
                ? 'bg-background-tertiary text-text-primary border-l-2 border-success'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
            }`}
            title={sidebarOpen ? "Trades" : undefined}
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Trades</span>
          </button>
        </nav>

        <div className="p-3 border-t border-border-primary space-y-2">
          <button
            onClick={fetchPrices}
            disabled={isPricesLoading}
            className={`w-full flex items-center ${sidebarOpen ? 'justify-center gap-2' : 'justify-center'} px-3 py-2.5 h-10 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-background-tertiary transition-all border border-border-primary text-sm font-medium active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            title={sidebarOpen ? "Actualizar" : undefined}
          >
            <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isPricesLoading ? 'animate-spin' : ''}`} />
            <span className={`transition-all duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Actualizar</span>
          </button>
          {sidebarOpen && (
            <div className="bg-background-tertiary rounded-lg p-3 border border-border-primary space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary text-sm">Dólar MEP</span>
                <span className="text-text-primary font-mono text-sm">{formatARS(mepRate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary text-sm">Posiciones</span>
                <span className="text-text-primary font-mono text-sm">{positions.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary text-sm">Trades</span>
                <span className="text-text-primary font-mono text-sm">{trades.length}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className={`w-full flex items-center ${sidebarOpen ? 'justify-center gap-2' : 'justify-center'} px-3 py-2.5 h-10 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-background-tertiary transition-all border border-border-primary text-sm font-medium active:scale-95`}
            title={sidebarOpen ? "Cerrar sesión" : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={`transition-all duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Cerrar sesión</span>
          </button>
          {lastUpdate && sidebarOpen && (
            <p className="text-sm text-text-tertiary mt-2 text-center transition-all duration-200">
              Actualizado: {lastUpdateFull || lastUpdate}
            </p>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-t border-border-primary px-2 py-2 safe-area-inset-bottom">
        <nav className="flex justify-around">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg transition-all active:scale-95 min-h-[52px] min-w-[70px] ${
              activeTab === 'dashboard'
                ? 'text-success bg-success/5'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs font-medium">Posiciones</span>
          </button>
          <button
            onClick={() => setActiveTab('graficos')}
            className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg transition-all active:scale-95 min-h-[52px] min-w-[70px] ${
              activeTab === 'graficos'
                ? 'text-success bg-success/5'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-xs font-medium">Gráficos</span>
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg transition-all active:scale-95 min-h-[52px] min-w-[70px] ${
              activeTab === 'trades'
                ? 'text-success bg-success/5'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs font-medium">Trades</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <main className={`flex-1 p-3 lg:p-4 pb-24 lg:pb-24 mt-14 lg:mt-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {activeTab === 'dashboard' ? (
          <>
            {/* Portfolio Selector */}
            <div className="mb-3">
              <PortfolioSelector />
            </div>

            {/* Compact Header - 3 Metrics */}
            <div className="grid grid-cols-3 gap-0 mb-3">
              <div className="bg-background-secondary rounded-l-lg p-4 border border-border-primary border-r-0">
                <p className="text-text-tertiary text-sm font-medium mb-1">Invertido</p>
                <p className="text-text-primary font-mono text-xl font-semibold">{formatARS(totals.invertido)}</p>
              </div>
              <div className="bg-background-secondary p-4 border border-border-primary">
                <p className="text-text-tertiary text-sm font-medium mb-1">Valuación Actual</p>
                <p className="text-text-primary font-mono text-xl font-semibold">{formatARS(totals.valuacion)}</p>
              </div>
              <div className="bg-background-secondary rounded-r-lg p-4 border border-border-primary border-l-0">
                <p className="text-text-tertiary text-sm font-medium mb-1">Resultado Total</p>
                <p className={`font-mono text-xl font-semibold ${totals.resultado >= 0 ? 'text-success' : 'text-danger'}`}>{formatARS(totals.resultado)}</p>
                <p className={`text-sm mt-0.5 ${totals.resultadoPct >= 0 ? 'text-success' : 'text-danger'}`}>{formatPercent(totals.resultadoPct)}</p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Buscar ticker..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary text-sm focus:outline-none focus:border-success"
                  />
                </div>
                <ColumnSelector settings={columnSettings} onSettingsChange={setColumnSettings} />
              </div>
              <button
                onClick={() => {
                  setEditingTrade(null);
                  setModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Transacción</span>
              </button>
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
                searchTerm={searchTerm}
                columnSettings={columnSettings}
                onColumnSettingsChange={setColumnSettings}
              />
            </div>

             {/* Footer - Desktop Only */}
            <div className={`hidden lg:block fixed bottom-0 right-0 bg-background-primary border-t border-border-primary py-2 px-6 transition-all duration-300 ${sidebarOpen ? 'left-64' : 'left-16'}`}>
              <p className="text-text-tertiary text-sm text-center">Argos Capital v3.0</p>
            </div>
          </>
        ) : activeTab === 'graficos' ? (
          <>
            {/* Gráficos Tab */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Análisis del Portfolio</h2>
              <div className="bg-background-secondary rounded-lg border border-border-primary p-4">
                <DistributionChart positions={positions} />
              </div>
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
                  className="flex items-center justify-center gap-2 px-5 py-3 h-11 bg-success text-white rounded-lg hover:bg-success/90 transition-all font-semibold text-sm active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nuevo Trade</span>
                  <span className="sm:hidden">Nuevo</span>
                </button>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 px-4 py-3 h-11 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-background-tertiary transition-all font-medium border border-border-primary text-sm active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Template</span>
                </button>
                <label className="flex items-center justify-center gap-2 px-4 py-3 h-11 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-background-tertiary transition-all font-medium border border-border-primary cursor-pointer text-sm active:scale-95 disabled:opacity-50">
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
                  <span className="hidden sm:inline">Importar</span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowFormatHelp(!showFormatHelp)}
                    className="flex items-center justify-center w-11 h-11 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-background-tertiary transition-all border border-border-primary active:scale-95"
                    title="Ayuda formato"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                  {showFormatHelp && (
                      <div className="format-help-tooltip absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 bg-background-secondary rounded-lg p-4 border border-border-primary shadow-xl">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-text-primary font-medium text-sm">📋 Formato CSV/Excel:</p>
                        <button
                          onClick={() => setShowFormatHelp(false)}
                          className="text-text-tertiary hover:text-text-primary p-1 rounded-lg hover:bg-background-tertiary active:scale-95 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <ul className="text-text-secondary space-y-1 text-sm ml-4">
                        <li>• <strong>Fecha:</strong> DD/MM/YYYY (ej: 23/12/2024)</li>
                        <li>• <strong>Ticker:</strong> Símbolo del activo (ej: MELI, AAPL, AL30)</li>
                        <li>• <strong>Cantidad:</strong> Número de unidades (ej: 10 o 1250.50)</li>
                        <li>• <strong>Precio:</strong> Precio de compra en ARS (ej: 17220 o 839.50)</li>
                        <li>• <strong>Bonos pesos:</strong> Precio por $1 VN (ej: 1.03)</li>
                      </ul>
                      <p className="text-text-tertiary mt-2 text-sm">
                        Tip: Descargá el template para ver un ejemplo completo
                      </p>
                    </div>
                  )}
                </div>
              </div>
               {importStatus && (
                <span className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                  importStatus.includes('✓') ? 'bg-success/10 text-success' :
                  importStatus.includes('Error') ? 'bg-danger/10 text-danger' :
                  'bg-background-tertiary text-text-secondary'
                }`}>
                  {importStatus}
                </span>
              )}
            </div>

            {/* Trades Table */}
            <div className="bg-background-secondary rounded-lg border border-border-primary overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                   <thead>
                     <tr className="bg-background-tertiary/30 border-b border-border-primary">
                       <th
                         className="text-left px-4 py-2.5 text-sm font-medium text-text-tertiary cursor-pointer hover:text-text-primary transition-colors"
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
                         className="text-left px-4 py-2.5 text-sm font-medium text-text-tertiary cursor-pointer hover:text-text-primary transition-colors"
                         onClick={() => handleSort('ticker')}
                       >
                         <div className="flex items-center gap-1">
                           Ticker
                           {sortConfig.key === 'ticker' && (
                             sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                           )}
                         </div>
                       </th>
                       <th className="text-right px-4 py-2.5 text-sm font-medium text-text-tertiary">Cantidad</th>
                       <th className="text-right px-4 py-2.5 text-sm font-medium text-text-tertiary">Precio</th>
                       <th className="text-right px-4 py-2.5 text-sm font-medium text-text-tertiary hidden sm:table-cell">Invertido</th>
                       <th className="text-right px-4 py-2.5 text-sm font-medium text-text-tertiary">Acciones</th>
                     </tr>
                   </thead>
                  <tbody className="divide-y divide-border-primary">
                    {sortedTrades.map((trade) => {
                      const isBono = isBonoPesos(trade.ticker);
                      return (
                        <tr key={trade.id} className="hover:bg-background-tertiary transition-colors">
                          <td className="px-4 py-2.5 text-text-secondary text-sm">
                            {new Date(trade.fecha).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-text-primary font-mono">{trade.ticker}</span>
                          </td>
                          <td className="text-right px-4 py-2.5 text-text-secondary font-mono">
                            {formatNumber(trade.cantidad)}
                          </td>
                          <td className="text-right px-4 py-2.5 text-text-primary font-mono font-medium">
                            {isBono ? `$${trade.precioCompra.toFixed(4)}` : formatARS(trade.precioCompra)}
                          </td>
                          <td className="text-right px-4 py-2.5 text-text-tertiary font-mono text-sm hidden sm:table-cell">
                            {formatARS(trade.cantidad * trade.precioCompra)}
                          </td>
                          <td className="text-right px-4 py-2.5">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingTrade(trade);
                                  setModalOpen(true);
                                }}
                                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-background-tertiary rounded-lg transition-all"
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
                    <div className="w-16 h-16 bg-background-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plus className="w-8 h-8 text-text-tertiary" />
                    </div>
                    <p className="text-text-tertiary mb-2 font-medium">No hay transacciones registradas</p>
                    <p className="text-text-tertiary/70 text-sm mb-4">Empezá importando un archivo CSV o agregando manualmente</p>
                      <div className="flex justify-center gap-3">
                      <button
                        onClick={() => {
                          setEditingTrade(null);
                          setModalOpen(true);
                        }}
                        className="text-primary hover:text-primary/80 font-medium text-sm"
                      >
                        Agregar transacción
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
