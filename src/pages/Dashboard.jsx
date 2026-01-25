import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, Loader2, PieChart, Search, Info } from 'lucide-react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../utils/formatters';
import { isBonoPesos, isBonoHardDollar, getAssetClass } from '../hooks/useBondPrices';
import { usePrices } from '../services/priceService';
import { downloadTemplate, parseAndImportTrades } from '../services/importExportService';
import DistributionChart from '../components/DistributionChart';
import SummaryCard from '../components/common/SummaryCard';
import PositionsTable from '../components/dashboard/PositionsTable';
import ColumnSelector from '../components/dashboard/ColumnSelector';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import DashboardSummaryCards from '../components/dashboard/DashboardSummaryCards';
import TotalCard from '../components/dashboard/TotalCard';
import { PortfolioTabs } from '../components/portfolio/PortfolioTabs';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { PortfolioSelector } from '../components/PortfolioSelector';
import { tradeService } from '../services/tradeService';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingFallback } from '../components/common/LoadingSpinner';
import TickerAutocomplete from '../components/common/TickerAutocomplete';
import logo from '../assets/logo.png';

const PositionDetailModal = lazy(() => import('../components/PositionDetailModal'));
const TradeModal = lazy(() => import('../components/modals/TradeModal'));
const DeleteModal = lazy(() => import('../components/modals/DeleteModal'));
const FciTransactionModal = lazy(() => import('../components/modals/FciTransactionModal'));
import { usePortfolioEngine } from '../hooks/usePortfolioEngine';
import { useFciEngine } from '../hooks/useFciEngine';
import FciTable from '../components/dashboard/FciTable';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { currentPortfolio, loading: portfolioLoading } = usePortfolio();

  const { prices: rawPrices, mepRate, tickers, lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();
  const prices = rawPrices || {};

  const lastUpdate = priceLastUpdate ? priceLastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
  const lastUpdateFull = priceLastUpdate ? priceLastUpdate.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : null;

  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Filtros de transacciones
  const [tradesSearchTerm, setTradesSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
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

  // Portfolio Engine - replaces local calculations
  const { positions, totals: allTotals, calculateTotals } = usePortfolioEngine(trades, prices, mepRate);

  // FCI Engine
  const {
    positions: fciPositions,
    totals: fciTotals,
    addTransaction: addFciTransaction,
    loading: fciLoading
  } = useFciEngine(currentPortfolio?.id);

  const [fciModalOpen, setFciModalOpen] = useState(false);
  const [fciModalType, setFciModalType] = useState('SUBSCRIPTION');
  const [selectedFciForModal, setSelectedFciForModal] = useState(null);

  const handleOpenFciSubscription = (fci = null) => {
    setFciModalType('SUBSCRIPTION');
    setSelectedFciForModal(fci);
    setFciModalOpen(true);
  };

  const handleOpenFciRedemption = (fci = null) => {
    setFciModalType('REDEMPTION');
    setSelectedFciForModal(fci);
    setFciModalOpen(true);
  };

  const handleSaveFciTransaction = async (transaction) => {
    try {
      // Add user_id to transaction (needed for RLS/Schema)
      const txWithUser = { ...transaction, user_id: user.id };
      await addFciTransaction(txWithUser);
      // Success? Close modal
      setFciModalOpen(false);
    } catch (e) {
      console.error("Error saving FCI tx", e);
      throw e; // Modal handles alert
    }
  };

  // Combine totals for Summary Cards
  const combinedTotals = useMemo(() => {
    // Si allTotals es null/undefined, inicializar en cero
    const safeTotals = allTotals || { invested: 0, valuation: 0, pnl: 0, dayPnl: 0 };

    return {
      ...safeTotals,
      invested: safeTotals.invested + (fciTotals?.invested || 0),
      valuation: safeTotals.valuation + (fciTotals?.valuation || 0),
      pnl: safeTotals.pnl + (fciTotals?.pnl || 0),
      // dayPnl no lo tenemos en FCI aun, asumimos 0 por ahora
    };
  }, [allTotals, fciTotals]);

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
      fecha: trade.trade_date,
      fechaFormatted: formatDateDMY(trade.trade_date),
      cantidad: trade.quantity,
      precioCompra: trade.price,
      tipo: trade.trade_type === 'buy' ? 'compra' : 'venta'
    }));

    // Aplicar filtros
    let filtered = mappedTrades;

    // Filtro de búsqueda
    if (tradesSearchTerm.trim()) {
      const term = tradesSearchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticker.toLowerCase().includes(term) ||
        t.fechaFormatted.includes(term)
      );
    }

    // Filtro de tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.tipo === typeFilter);
    }

    // Filtro de ticker/activo
    if (tickerFilter !== 'all') {
      filtered = filtered.filter(t => t.ticker === tickerFilter);
    }

    // Filtro de período
    if (periodFilter !== 'all') {
      const now = new Date();
      let fromDate = null;

      switch (periodFilter) {
        case 'last_month':
          fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'last_3_months':
          fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case 'last_year':
          fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          fromDate = null;
      }

      if (fromDate) {
        filtered = filtered.filter(t => {
          const tradeDate = new Date(t.fecha);
          return tradeDate >= fromDate;
        });
      }
    }

    // Ordenar
    const sorted = [...filtered].sort((a, b) => {
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
  }, [trades, sortConfig, tradesSearchTerm, typeFilter, tickerFilter, periodFilter]);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSaveTrade = useCallback(async (trade) => {
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

  if (!currentPortfolio) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-tertiary mb-4">No tienes portfolios creados.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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
        {/* Header mobile top */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PortfolioSelector />
              <img src={logo} alt="Argos Capital" className="w-8 h-8" />
              <h1 className="text-lg font-bold text-text-primary">Argos Capital</h1>
            </div>
            <button
              onClick={() => refetchPrices()}
              disabled={isPricesLoading}
              className="p-3 h-12 w-12 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title="Actualizar"
              aria-label="Actualizar"
            >
              <RefreshCw className={`w-5 h-5 ${isPricesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sidebar desktop */}
        <DashboardSidebar
          user={user}
          signOut={signOut}
          isExpanded={sidebarExpanded}
          setIsExpanded={setSidebarExpanded}
        />

        <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-x-hidden ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
          <div className="p-2 lg:p-3 space-y-2 lg:space-y-3">

            {/* Page Header with Actions (matching Financiacion structure) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative min-h-[48px] z-20">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-lg lg:text-xl font-bold text-text-primary leading-tight">Portfolio</h1>
                  <p className="text-text-tertiary text-[10px] uppercase font-semibold tracking-wider">Resumen</p>
                </div>
                <div className="hidden lg:block border-l border-border-primary h-8 mx-1"></div>
                {/* Selector de Portfolio (Merged into Header) */}
                <div className="hidden lg:block scale-90 origin-left">
                  <PortfolioSelector />
                </div>
              </div>

              {/* Centered Logo (Desktop) - Smaller size */}
              <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                <img src={logo} alt="Argos Capital" className="w-6 h-6" />
                <h1 className="text-lg font-bold text-text-primary tracking-tight">Argos Capital</h1>
              </div>

              <div className="flex items-center gap-2">
                <DashboardHeader
                  mepRate={mepRate}
                  lastUpdate={lastUpdate}
                  isPricesLoading={isPricesLoading}
                  refetchPrices={refetchPrices}
                  compact={true}
                  showLogo={false}
                />
              </div>
            </div>

            {/* Mobile Selector Only */}
            <div className="lg:hidden relative z-30">
              <PortfolioSelector />
            </div>

            {/* Sub-navigation (Tabs) */}
            <div className="bg-background-secondary/50 border border-border-primary/50 rounded-lg p-1">
              <PortfolioTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                currentPortfolio={currentPortfolio}
                variant="pills"
              />
            </div>

            {/* Dynamic Content */}
            <div className="min-h-0">

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
                <div className="max-w-3xl mx-auto">
                  <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-text-primary mb-4">Distribución del Portfolio</h2>
                    <DistributionChart positions={positions} />
                  </div>
                </div>
              )}

              {activeTab === 'trades' && (
                <div className="space-y-4 lg:space-y-6">
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

                      {/* Filtro Período */}
                      <div className="lg:flex-1">
                        <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Período</label>
                        <select
                          value={periodFilter}
                          onChange={(e) => setPeriodFilter(e.target.value)}
                          className="w-full px-3 lg:px-4 py-2.5 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                        >
                          <option value="all">Todos</option>
                          <option value="last_month">Último mes</option>
                          <option value="last_3_months">Últimos 3 meses</option>
                          <option value="last_year">Último año</option>
                        </select>
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
                  <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
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

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="bg-background-tertiary text-left text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                            <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('fecha')}>
                              <div className="flex items-center gap-1">Fecha {sortConfig.key === 'fecha' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </th>
                            <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('ticker')}>
                              <div className="flex items-center gap-1">Ticker {sortConfig.key === 'ticker' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </th>
                            <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors whitespace-nowrap" onClick={() => handleSort('tipo')}>
                              <div className="flex items-center gap-1">Tipo {sortConfig.key === 'tipo' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </th>
                            <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors text-right whitespace-nowrap" onClick={() => handleSort('cantidad')}>
                              <div className="flex items-center justify-end gap-1">Cant. {sortConfig.key === 'cantidad' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </th>
                            <th className="px-3 sm:px-4 py-3 cursor-pointer hover:text-text-primary transition-colors text-right whitespace-nowrap" onClick={() => handleSort('precioCompra')}>
                              <div className="flex items-center justify-end gap-1">Precio {sortConfig.key === 'precioCompra' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </th>
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
                            <tr key={trade.id || idx} className="hover:bg-[#151515] transition-all duration-200">
                              <td className="px-3 sm:px-4 py-3 text-sm text-text-primary whitespace-nowrap">{trade.fechaFormatted}</td>
                              <td className="px-3 sm:px-4 py-3 text-sm font-bold text-text-primary whitespace-nowrap">{trade.ticker}</td>
                              <td className="px-3 sm:px-4 py-3">
                                <span className={`inline-flex px-2 sm:px-3 py-1 rounded-md text-xs font-semibold border ${trade.tipo === 'compra'
                                  ? 'bg-success/15 text-success border-success/20'
                                  : 'bg-danger/15 text-danger border-danger/20'
                                  }`}>
                                  {trade.tipo === 'compra' ? 'Compra' : 'Venta'}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatNumber(Math.abs(trade.cantidad), 2)}</td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatARS(trade.precioCompra)}</td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold tabular-nums text-text-primary">{formatARS(Math.abs(trade.cantidad) * trade.precioCompra)}</td>
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

              {activeTab === 'dashboard' && (
                <>
                  {/* Portfolio Tabs - positioned below header and above summary cards for mobile */}
                  <div className="lg:hidden">
                    <PortfolioTabs
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      currentPortfolio={currentPortfolio}
                    />
                  </div>
                  <DashboardSummaryCards totals={combinedTotals} lastUpdate={lastUpdate} />

                  {/* Sección de FCIs (Liquidez) */}
                  <div className="bg-background-secondary border border-border-primary rounded-xl flex flex-col mt-3 overflow-hidden">
                    <div className="p-2 lg:p-3 border-b border-border-primary flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm lg:text-base font-semibold text-text-primary">Fondos Comunes (Liquidez)</h2>
                        <span className="text-[10px] text-text-tertiary bg-background-tertiary px-1.5 py-0.5 rounded-full">{fciPositions.length}</span>
                      </div>
                      <button onClick={() => handleOpenFciSubscription()} className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-background-tertiary text-text-primary border border-border-secondary rounded-lg hover:bg-background-tertiary/80 transition-all text-xs font-medium">
                        <Plus className="w-3.5 h-3.5" />
                        Suscribir/Rescatar
                      </button>
                    </div>
                    {fciLoading ? (
                      <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    ) : (
                      <FciTable
                        positions={fciPositions}
                        onSubscribe={handleOpenFciSubscription}
                        onRedeem={handleOpenFciRedemption}
                      />
                    )}
                  </div>

                  {/* Tabla de Posiciones - contenedor con scroll interno limitado */}
                  <div className="bg-background-secondary border border-border-primary rounded-xl flex flex-col h-[400px] lg:h-[calc(100vh-450px)] min-h-[300px] mt-3">
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
                        <PositionsTable positions={filteredPositions} onRowClick={handleOpenPositionDetail} prices={prices} mepRate={mepRate} sortConfig={positionsSort} onSortChange={setPositionsSort} columnSettings={columnSettings} onColumnSettingsChange={setColumnSettings} />
                      )}
                    </div>
                  </div>

                  {/* Total Card - completamente separado de la tabla */}
                  {filteredPositions.length > 0 && (
                    <div className="mt-2">
                      <TotalCard totals={filteredTotals} columnSettings={columnSettings} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>

        <Suspense fallback={<LoadingFallback />}>
          <TradeModal isOpen={modalOpen} onClose={handleCloseModal} onSave={handleSaveTrade} trade={editingTrade} tickers={tickers} />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <DeleteModal isOpen={deleteModalOpen} onClose={handleCloseDeleteModal} onConfirm={handleDeleteTrade} tradeTicker={deletingTrade?.ticker} />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <PositionDetailModal open={detailModalOpen} onClose={handleClosePositionDetail} position={selectedPosition} prices={prices} mepRate={mepRate} trades={trades} onTradeClick={handleTradeClickFromDetail} />
        </Suspense>
        <Suspense fallback={<LoadingFallback />}>
          <FciTransactionModal
            isOpen={fciModalOpen}
            onClose={() => setFciModalOpen(false)}
            onSave={handleSaveFciTransaction}
            portfolioId={currentPortfolio?.id}
            initialType={fciModalType}
            initialFci={selectedFciForModal}
          />
        </Suspense>
      </div >
    </ErrorBoundary >
  );
}
