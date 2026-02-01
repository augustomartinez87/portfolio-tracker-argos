import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, Loader2, PieChart, Search, Info, LayoutDashboard } from 'lucide-react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '@/utils/formatters';
import { isBonoPesos, isBonoHardDollar, getAssetClass } from '@/features/portfolio/hooks/useBondPrices';
import { usePrices, invokeFetchPrices } from '@/features/portfolio/services/priceService';
import { downloadTemplate, parseAndImportTrades } from '@/features/portfolio/services/importExportService';
import DistributionChart from '@/features/portfolio/components/DistributionChart';
import SummaryCard from '@/components/common/SummaryCard';
import PositionsTable from '@/features/portfolio/components/PositionsTable';
import ColumnSelector from '@/features/portfolio/components/ColumnSelector';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import DashboardSummaryCards from '@/features/portfolio/components/DashboardSummaryCards';
import TotalCard from '@/features/portfolio/components/TotalCard';
import { PortfolioTabs } from '@/features/portfolio/components/PortfolioTabs';
import { PortfolioCharts } from '@/features/portfolio/components/PortfolioCharts';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import MobileNav from '@/components/common/MobileNav';
import { PortfolioSelector } from '@/features/portfolio/components/PortfolioSelector';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
// Consolidated LayoutDashboard above
import { tradeService } from '@/features/portfolio/services/tradeService';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingFallback } from '@/components/common/LoadingSpinner';
import TickerAutocomplete from '@/components/common/TickerAutocomplete';
import logo from '@/assets/logo.png';

const PositionDetailModal = lazy(() => import('@/features/portfolio/components/PositionDetailModal'));
const TradeModal = lazy(() => import('@/features/portfolio/components/TradeModal'));
const DeleteModal = lazy(() => import('@/features/portfolio/components/DeleteModal'));
import { usePortfolioEngine } from '@/features/portfolio/hooks/usePortfolioEngine';
import { DateRangeSelector, getDateRange } from '@/components/common/DateRangeSelector.jsx';
import { useSearch } from '@/features/portfolio/hooks/useSearch';
import { CurrencySelector } from '@/features/portfolio/components/CurrencySelector';
import { mepService } from '@/features/portfolio/services/mepService';
import { TRANSACTION_TYPES } from '@/constants';


export default function Dashboard() {
  const { user, signOut } = useAuth();
  const {
    currentPortfolio,
    loading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolios,
    fciPositions,
    refreshFci
  } = usePortfolio();

  const { prices, mepRate, tickers, lastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();

  const lastUpdateFull = lastUpdate ? lastUpdate.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : null;

  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'resumen';

  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState('ARS');
  const [mepHistory, setMepHistory] = useState([]);

  // Cargar historial de MEP para cálculos exactos
  useEffect(() => {
    const loadMepHistory = async () => {
      const history = await mepService.getHistory();
      setMepHistory(history);
    };
    loadMepHistory();
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingTrade, setDeletingTrade] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [positionsSort, setPositionsSort] = useState({ key: 'valuation', direction: 'desc' });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [tradesLoading, setTradesLoading] = useState(false);
  const { searchTerm, setSearchTerm, clearSearch } = useSearch();
  // Filtros de transacciones
  const [dateRangeValue, setDateRangeValue] = useState('all');
  const [tradesSearchTerm, setTradesSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [columnSettings, setColumnSettings] = useState({
    showPPC: true,
    showInvertido: true,
    showDiario: true,
    showDiarioPct: true,
    density: 'compact'
  });

  const loadTrades = useCallback(async () => {
    if (!currentPortfolio?.id) {
      setTrades([]);
      return;
    }

    setTradesLoading(true);
    try {
      const data = await tradeService.getTrades(currentPortfolio.id);
      setTrades(data || []);
    } catch (error) {
      console.error('Error loading trades:', error);
      setTrades([]);
    } finally {
      setTradesLoading(false);
    }
  }, [currentPortfolio]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const handleManualRefresh = useCallback(async () => {
    try {
      if (activeTab === 'trades' || activeTab === 'distribution') {
        await Promise.all([refetchPrices(), refreshFci()]);
      } else {
        await refetchPrices();
      }
    } catch (error) {
      console.error("Manual refresh failed", error);
    }
  }, [refetchPrices, activeTab, refreshFci]);

  const handleDownloadTemplate = useCallback(() => {
    downloadTemplate();
  }, []);

  const importFromCSV = useCallback(async (event) => {
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

    try {
      const result = await parseAndImportTrades(file, currentPortfolio.id, user.id);
      setImportStatus(result.message);

      if (result.success) {
        loadTrades();
        setTimeout(() => setImportStatus(null), 5000);
      } else {
        setTimeout(() => setImportStatus(null), 3000);
      }
    } catch (error) {
      setImportStatus('Error inesperado al importar');
      setTimeout(() => setImportStatus(null), 3000);
    } finally {
      setIsLoading(false);
      event.target.value = null;
    }
  }, [currentPortfolio, user, loadTrades]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFormatHelp && !event.target.closest('.format-help-tooltip')) {
        setShowFormatHelp(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFormatHelp]);

  // Portfolio Engine - handles calculations with historical precision
  const { positions, totals: allTotals, calculateTotals, isPricesReady } = usePortfolioEngine(
    trades,
    prices,
    mepRate,
    mepHistory,
    fciPositions
  );

  // Filtrar posiciones dinámicamente según búsqueda
  const filteredPositions = useMemo(() => {
    if (!searchTerm) return positions;
    const term = searchTerm.toLowerCase();
    return positions.filter(p =>
      p.ticker.toLowerCase().includes(term) ||
      (p.assetClass && p.assetClass.toLowerCase().includes(term))
    );
  }, [positions, searchTerm]);

  const filteredTotals = useMemo(() => {
    return calculateTotals(filteredPositions, mepRate);
  }, [filteredPositions, mepRate, calculateTotals]);

  // Lista de tickers únicos para el filtro
  const uniqueTickers = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return [];
    const tickers = [...new Set(trades.map(t => t.ticker))].sort();
    return tickers;
  }, [trades]);

  // Función para formatear fecha a dd/mm/yyyy
  const formatDateDMY = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

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

    // Aplicar filtros
    let filtered = mappedTrades;

    // Filtro de búsqueda
    if (tradesSearchTerm.trim()) {
      const term = tradesSearchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticker.toLowerCase().includes(term) ||
        t.dateFormatted.includes(term)
      );
    }

    // Filtro de tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    // Filtro de ticker/activo
    if (tickerFilter !== 'all') {
      filtered = filtered.filter(t => t.ticker === tickerFilter);
    }

    // Filtro de período (Updated to use DateRangeSelector logic)
    if (dateRangeValue !== 'all') {
      const { startDate } = getDateRange(dateRangeValue);
      if (startDate) {
        filtered = filtered.filter(t => {
          const tradeDate = new Date(t.date);
          return tradeDate >= startDate;
        });
      }
    }

    // Ordenar
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

  const handleSaveTrade = useCallback(async (trade) => {
    if (!currentPortfolio || !user) return;

    const userId = currentPortfolio.user_id || user.id;

    console.log('DEBUG handleSaveTrade - PRE-SAVE:', {
      'auth_user_id': user.id,
      'portfolio_owner_id': currentPortfolio.user_id,
      'using_user_id': userId,
      'portfolio_id': currentPortfolio.id,
      'editingTrade': editingTrade
    });

    try {
      if (editingTrade) {
        await tradeService.updateTrade(trade.id, {
          ticker: trade.ticker,
          trade_type: trade.type === TRANSACTION_TYPES.BUY ? 'buy' : 'sell',
          quantity: Math.abs(trade.quantity),
          price: trade.price,
          total_amount: Math.abs(trade.quantity) * trade.price,
          currency: 'ARS',
          trade_date: trade.date
        });
      } else {
        await tradeService.createTrade(currentPortfolio.id, userId, {
          ticker: trade.ticker,
          trade_type: trade.type === TRANSACTION_TYPES.BUY ? 'buy' : 'sell',
          quantity: Math.abs(trade.quantity),
          price: trade.price,
          total_amount: Math.abs(trade.quantity) * trade.price,
          currency: 'ARS',
          trade_date: trade.date
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
  }, [currentPortfolio, user, editingTrade]);

  const handleDeleteTrade = useCallback(async () => {
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
  }, [deletingTrade, currentPortfolio]);

  const handleOpenPositionDetail = useCallback((position) => {
    setSelectedPosition(position);
    setDetailModalOpen(true);
  }, []);

  const handleClosePositionDetail = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedPosition(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingTrade(null);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeletingTrade(null);
  }, []);

  const handleTradeClickFromDetail = useCallback((trade) => {
    const t = sortedTrades.find(st => st.id === trade.id);
    if (t) {
      setEditingTrade(t);
      setDetailModalOpen(false);
      setModalOpen(true);
    }
  }, [sortedTrades]);

  if (portfolioLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-tertiary">Cargando portfolio...</p>
        </div>
      </div>
    );
  }

  if (portfolioError) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Error al cargar</h2>
          <p className="text-text-tertiary mb-4 text-sm">{portfolioError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => refetchPortfolios()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-background-secondary text-text-primary border border-border-primary rounded-lg hover:bg-background-tertiary transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background-primary flex">
        {/* Header mobile top */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Argos Capital" className="w-8 h-8" />
              <h1 className="text-lg font-bold text-text-primary">Argos</h1>
            </div>
            <PortfolioSelector />
          </div>
        </div>

        {/* Sidebar desktop */}
        <DashboardSidebar
          user={user}
          signOut={signOut}
          isExpanded={sidebarExpanded}
          setIsExpanded={setSidebarExpanded}
        />

        <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-hidden h-screen flex flex-col mb-16 lg:mb-0 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
          <div className="p-3 lg:p-4 space-y-3 flex flex-col h-full overflow-hidden">

            <PageHeader
              title="Portfolio"
              subtitle="Resumen"
              icon={LayoutDashboard}
              loading={isPricesLoading || isPricesFetching}
              onRefresh={handleManualRefresh}
              displayCurrency={displayCurrency}
              onCurrencyChange={setDisplayCurrency}
              onHelpClick={() => navigate('/dashboard/help')}
            />

            {!currentPortfolio ? (
              <PortfolioEmptyState />
            ) : (
              <>
                {/* Sub-navigation (Tabs) */}
                <div className="bg-background-secondary/50 border border-border-primary rounded-lg p-1">
                  <PortfolioTabs
                    activeTab={activeTab}
                    currentPortfolio={currentPortfolio}
                    variant="pills"
                  />
                </div>


                {/* Dynamic Content */}
                <div className="min-h-0 flex-1 flex flex-col overflow-hidden">

                  {activeTab === 'help' && (
                    <div className="max-w-3xl mx-auto py-4">
                      <div className="bg-background-secondary border border-border-primary rounded-xl p-6 lg:p-8">
                        <h2 className="text-xl font-bold text-text-primary mb-6">Guía de Uso</h2>
                        <div className="space-y-6 text-text-secondary">
                          <div className="p-4 bg-warning-muted border border-warning/30 rounded-lg">
                            <p className="text-warning text-sm">
                              <strong>Nota:</strong> Los precios de CEDEARs y bonos mostrados en la app están expresados en pesos argentinos (ARS).
                              Los bonos hard dollar (AL30, GD30, etc.) muestran su precio en pesos, representando el valor de cada lamina de USD 100.
                            </p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-text-primary mb-2">Agregar Transacciones</h3>
                            <p className="text-sm">Haz clic en el botón "+" para registrar una nueva transacción. Indica si es compra o venta, la fecha, el ticker y la cantidad.</p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-text-primary mb-2">Precios</h3>
                            <p className="text-sm">Los precios se actualizan automáticamente cada 30 segundos. Puedes forzar una actualización con el botón de refresh.</p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-text-primary mb-2">Importar CSV</h3>
                            <p className="text-sm">Descarga la plantilla CSV, completa tus transacciones y súbela para importarlas masivamente.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'distribution' && (
                    <div className="flex-1 overflow-y-auto w-full py-4 pr-1">
                      <div className="max-w-6xl mx-auto">
                        <PortfolioCharts positions={positions} currency={displayCurrency} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'trades' && (
                    <div className="flex-1 flex flex-col min-h-0 space-y-4 lg:space-y-6 overflow-y-auto pr-1">
                      {/* Sección de Filtros */}
                      <div className="bg-background-secondary border border-border-primary rounded-xl p-3 sm:p-4 lg:p-5">
                        {/* Buscador - fila completa en móvil */}
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

                        {/* Grid de filtros */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row gap-3 lg:gap-4">
                          {/* Buscador - visible solo en desktop */}
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

                          {/* Filtro Período (Replaced with DateRangeSelector) */}
                          <div className="lg:flex-[1.5]">
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Período</label>
                            <DateRangeSelector
                              selectedRange={dateRangeValue}
                              onChange={setDateRangeValue}
                              className="w-full justify-between"
                            />
                          </div>

                          {/* Filtro Tipo */}
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

                          {/* Filtro Activo */}
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

                      {/* Tabla de Transacciones */}
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
                            <button onClick={handleDownloadTemplate} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 h-8 w-8 sm:w-auto bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary" title="Descargar plantilla">
                              <Download className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="hidden sm:inline">Plantilla</span>
                            </button>
                            <label className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 h-8 w-8 sm:w-auto bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary cursor-pointer" title="Importar CSV">
                              <Download className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="hidden sm:inline">Importar</span>
                              <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" disabled={isLoading} />
                            </label>
                            <button onClick={() => { setEditingTrade(null); setModalOpen(true); }} className="flex items-center justify-center gap-1.5 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20" title="Nueva transacción">
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
                                      ? 'bg-[#10b9811a] text-[#10b981] border-[#10b98133]'
                                      : 'bg-[#ef44441a] text-[#ef4444] border-[#ef444433]'
                                      }`}>
                                      {trade.type === 'compra' ? 'Compra' : 'Venta'}
                                    </span>
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatNumber(Math.abs(trade.quantity), 2)}</td>
                                  <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatARS(trade.price)}</td>
                                  <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatARS(Math.abs(trade.quantity) * trade.price)}</td>
                                  <td className="px-3 sm:px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => { setEditingTrade(trade); setModalOpen(true); }} className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-tertiary rounded transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => { setDeletingTrade(trade); setDeleteModalOpen(true); }} className="p-1.5 text-text-tertiary hover:text-danger hover:bg-background-tertiary rounded transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'resumen' && (
                    <>
                      {/* Portfolio Tabs removed from here - already visible above in the main flow */}
                      <DashboardSummaryCards
                        totals={allTotals}
                        lastUpdate={lastUpdate}
                        isLoading={!isPricesReady || isPricesLoading}
                        currency={displayCurrency}
                      />



                      {/* Tabla de Posiciones - contenedor con scroll interno limitado - FLEX GROW para llenar espacio */}
                      <div className="bg-background-secondary border border-border-primary rounded-xl flex flex-col flex-1 min-h-0 mt-3 overflow-hidden">
                        <div className="p-2 lg:p-3 border-b border-border-primary flex flex-wrap gap-2 items-center justify-between flex-shrink-0">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <h2 className="text-sm lg:text-base font-semibold text-text-primary">Posiciones</h2>
                              <span className="text-[10px] text-text-tertiary bg-background-tertiary px-1.5 py-0.5 rounded-full">{positions.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                                <input type="text" placeholder="Buscar" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-3 py-1 h-7 bg-background-tertiary border border-border-primary rounded text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary w-40" />
                              </div>
                              <ColumnSelector settings={columnSettings} onSettingsChange={setColumnSettings} />
                            </div>
                          </div>
                          <button onClick={() => { setEditingTrade(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20">
                            <Plus className="w-3.5 h-3.5" />
                            Nueva Transacción
                          </button>
                        </div>
                        <div className="flex-1 overflow-auto min-h-0 custom-scrollbar">
                          {isPricesLoading && positions.length === 0 ? (
                            <div className="p-8 space-y-4">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="animate-pulse flex items-center gap-4">
                                  <div className="h-6 bg-background-tertiary rounded w-20"></div>
                                  <div className="h-6 bg-background-tertiary rounded w-16"></div>
                                  <div className="h-6 bg-background-tertiary rounded w-24 flex-1"></div>
                                  <div className="h-6 bg-background-tertiary rounded w-20"></div>
                                  <div className="h-6 bg-background-tertiary rounded w-16"></div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <PositionsTable positions={filteredPositions} onRowClick={handleOpenPositionDetail} prices={prices} mepRate={mepRate} sortConfig={positionsSort} onSortChange={setPositionsSort} columnSettings={columnSettings} onColumnSettingsChange={setColumnSettings} currency={displayCurrency} />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>

        <Suspense fallback={<LoadingFallback />}>
          <TradeModal isOpen={modalOpen} onClose={handleCloseModal} onSave={handleSaveTrade} trade={editingTrade} tickers={tickers} />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <DeleteModal isOpen={deleteModalOpen} onClose={handleCloseDeleteModal} onConfirm={handleDeleteTrade} tradeTicker={deletingTrade?.ticker} />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <PositionDetailModal open={detailModalOpen} onClose={handleClosePositionDetail} position={selectedPosition} prices={prices} mepRate={mepRate} trades={trades} onTradeClick={handleTradeClickFromDetail} currency={displayCurrency} />
        </Suspense>
      </div>
      <MobileNav />
    </ErrorBoundary>
  );
}
