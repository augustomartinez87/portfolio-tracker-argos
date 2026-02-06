import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, LayoutDashboard } from 'lucide-react';
import { usePrices } from '@/features/portfolio/services/priceService';
import { downloadTemplate, parseAndImportTrades } from '@/features/portfolio/services/importExportService';
import PositionsTable from '@/features/portfolio/components/PositionsTable';
import ColumnSelector from '@/features/portfolio/components/ColumnSelector';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { SidebarToggleButton } from '@/components/common/SidebarToggleButton';
import DashboardSummaryCards from '@/features/portfolio/components/DashboardSummaryCards';
import PerformanceMetricsCards from '@/features/portfolio/components/PerformanceMetricsCards';
import { usePerformanceMetrics } from '@/features/portfolio/hooks/usePerformanceMetrics';
import { PortfolioTabs } from '@/features/portfolio/components/PortfolioTabs';
import { PortfolioCharts } from '@/features/portfolio/components/PortfolioCharts';
import { TradesTabContent } from '@/features/portfolio/components/TradesTabContent';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import MobileNav from '@/components/common/MobileNav';
import { PortfolioSelector } from '@/features/portfolio/components/PortfolioSelector';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import { tradeService } from '@/features/portfolio/services/tradeService';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingFallback } from '@/components/common/LoadingSpinner';
import logo from '@/assets/logo.png';

const PositionDetailModal = lazy(() => import('@/features/portfolio/components/PositionDetailModal'));
const TradeModal = lazy(() => import('@/features/portfolio/components/TradeModal'));
const DeleteModal = lazy(() => import('@/features/portfolio/components/DeleteModal'));
import { usePortfolioEngine } from '@/features/portfolio/hooks/usePortfolioEngine';
import { useSearch } from '@/features/portfolio/hooks/useSearch';
import { mepService } from '@/features/portfolio/services/mepService';
import { TRANSACTION_TYPES } from '@/constants';


export default function Dashboard() {
  const { user, signOut } = useAuth();
  const {
    currentPortfolio,
    loading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolios,
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
  const [positionsSort, setPositionsSort] = useState({ key: 'valuation', direction: 'desc' });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useSidebarState();



  const [tradesLoading, setTradesLoading] = useState(false);
  const { searchTerm, setSearchTerm, clearSearch } = useSearch();
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

  // Portfolio Engine - handles calculations with historical precision
  const { positions, totals: allTotals, calculateTotals, isPricesReady } = usePortfolioEngine(
    trades,
    prices,
    mepRate,
    mepHistory
  );

  // Performance Metrics (XIRR, YTD, TWR)
  const performanceMetrics = usePerformanceMetrics(
    trades,
    allTotals,
    { enabled: isPricesReady && trades.length > 0, currency: displayCurrency }
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

  const handleSaveTrade = useCallback(async (trade) => {
    if (!currentPortfolio || !user) return;

    const userId = currentPortfolio.user_id || user.id;

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
    if (trade) {
      setEditingTrade(trade);
      setDetailModalOpen(false);
      setModalOpen(true);
    }
  }, []);

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
              sidebarToggle={<SidebarToggleButton isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />}
            />

            {!currentPortfolio ? (
              <PortfolioEmptyState />
            ) : (
              <>
                {/* Sub-navigation (Tabs) */}
                <PortfolioTabs
                  activeTab={activeTab}
                  currentPortfolio={currentPortfolio}
                />


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
                    <TradesTabContent
                      trades={trades}
                      onEditTrade={(trade) => { setEditingTrade(trade); setModalOpen(true); }}
                      onDeleteTrade={(trade) => { setDeletingTrade(trade); setDeleteModalOpen(true); }}
                      onNewTrade={() => { setEditingTrade(null); setModalOpen(true); }}
                      onDownloadTemplate={handleDownloadTemplate}
                      onImportCSV={importFromCSV}
                      isLoading={isLoading}
                      importStatus={importStatus}
                    />
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

                      {/* Performance Metrics (XIRR, YTD, TWR) */}
                      <PerformanceMetricsCards
                        metrics={performanceMetrics}
                        isLoading={!isPricesReady || isPricesLoading}
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
