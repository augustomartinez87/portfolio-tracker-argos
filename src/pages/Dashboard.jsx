import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, Loader2, PieChart, Search, Info } from 'lucide-react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../utils/formatters';
import { isBonoPesos, isBonoHardDollar, getAssetClass } from '../hooks/useBondPrices';
import { parseARSNumber, parseDateDMY } from '../utils/parsers';
import { usePrices } from '../services/priceService';
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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { currentPortfolio, loading: portfolioLoading } = usePortfolio();

  const { prices, mepRate, tickers, lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();

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

  const downloadTemplate = useCallback(() => {
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
              await tradeService.createTrade(currentPortfolio.id, user.id, trade);
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

  const positions = useMemo(() => {
    const grouped = {};

    // Ordenar trades por fecha para procesar en orden cronológico
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(a.trade_date || a.fecha);
      const dateB = new Date(b.trade_date || b.fecha);
      return dateA - dateB;
    });

    sortedTrades.forEach(trade => {
      if (!grouped[trade.ticker]) {
        grouped[trade.ticker] = {
          ticker: trade.ticker,
          trades: [],
          cantidadTotal: 0,
          costoTotal: 0
        };
      }
      grouped[trade.ticker].trades.push(trade);

      const cantidad = Math.abs(trade.quantity || trade.cantidad || 0);
      const precio = trade.price || trade.precioCompra || 0;
      const isSell = trade.trade_type === 'sell' || trade.tipo === 'venta';

      if (isSell) {
        // Venta: reducir cantidad y costo proporcionalmente (método promedio ponderado)
        const pos = grouped[trade.ticker];
        const precioPromedioActual = pos.cantidadTotal > 0 ? pos.costoTotal / pos.cantidadTotal : 0;
        const cantidadAVender = Math.min(cantidad, pos.cantidadTotal); // No vender más de lo que hay

        pos.cantidadTotal -= cantidadAVender;
        pos.costoTotal -= cantidadAVender * precioPromedioActual;

        // Evitar valores negativos por errores de redondeo
        if (pos.cantidadTotal < 0.0001) {
          pos.cantidadTotal = 0;
          pos.costoTotal = 0;
        }
      } else {
        // Compra: sumar cantidad y costo
        grouped[trade.ticker].cantidadTotal += cantidad;
        grouped[trade.ticker].costoTotal += cantidad * precio;
      }
    });

    // Filtrar posiciones con cantidad 0 (completamente vendidas)
    return Object.values(grouped).filter(pos => pos.cantidadTotal > 0).map(pos => {
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
      invertidoUSD: mepRate > 0 ? invertido / mepRate : 0,
      valuacionUSD: mepRate > 0 ? valuacion / mepRate : 0,
      resultadoUSD: mepRate > 0 ? resultado / mepRate : 0,
      resultadoDiarioUSD: mepRate > 0 ? resultadoDiario / mepRate : 0
    };
  }, [positions, mepRate]);

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
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">

            {/* Page Header with Actions (matching Financiacion structure) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-semibold text-text-primary">Portfolio</h1>
                <p className="text-text-tertiary text-sm mt-1">
                  Resumen general y posiciones
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DashboardHeader
                  mepRate={mepRate}
                  lastUpdate={lastUpdate}
                  isPricesLoading={isPricesLoading}
                  refetchPrices={refetchPrices}
                  simpleMode={true}
                />
              </div>
            </div>

            {/* Selector de Portfolio (Desktop only) */}
            <div className="hidden lg:block">
              <PortfolioSelector />
            </div>

            {/* Sub-navigation (Tabs) */}
            <div className="bg-background-secondary border border-border-primary rounded-xl p-2">
              <PortfolioTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                currentPortfolio={currentPortfolio}
                variant="pills"
              />
            </div>

            {/* Dynamic Content */}
            <div className="min-h-[400px]">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <DashboardSummaryCards
                    totals={totals}
                    trades={trades}
                    lastUpdate={lastUpdateFull}
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <PositionsTable
                        positions={positions}
                        columnSettings={columnSettings}
                        sortConfig={positionsSort}
                        onSort={(key) => setPositionsSort(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }))}
                        onRowClick={handleOpenPositionDetail}
                      />
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                      <TotalCard totals={totals} mepRate={mepRate} columnSettings={columnSettings} />
                      <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-text-primary mb-4">Distribución</h3>
                        <DistributionChart positions={positions} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'help' && (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-background-secondary border border-border-primary rounded-xl p-6 lg:p-8">
                    <h2 className="text-xl font-bold text-text-primary mb-6">Guía de Uso</h2>
                    <div className="space-y-6 text-text-secondary">
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-400 text-sm">
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
                        <button onClick={downloadTemplate} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 h-8 w-8 sm:w-auto bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary" title="Descargar plantilla">
                          <Download className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="hidden sm:inline">Plantilla</span>
                        </button>
                        <label className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 h-8 w-8 sm:w-auto bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary cursor-pointer" title="Importar CSV">
                          <Download className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="hidden sm:inline">Importar</span>
                          <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" disabled={isLoading} />
                        </label>
                        <button onClick={() => { setEditingTrade(null); setModalOpen(true); }} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 h-8 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-xs font-medium" title="Nueva transacción">
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
                  <DashboardSummaryCards totals={totals} lastUpdate={lastUpdate} />

                  {/* Tabla de Posiciones - contenedor separado */}
                  <div className="bg-background-secondary border border-border-primary rounded-xl flex flex-col h-[calc(100vh-360px)] min-h-[280px]">
                    <div className="p-3 lg:p-4 border-b border-border-primary flex flex-wrap gap-3 items-center justify-between flex-shrink-0">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base lg:text-lg font-semibold text-text-primary">Posiciones</h2>
                          <span className="text-xs text-text-tertiary bg-background-tertiary px-2 py-0.5 rounded-full">{positions.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <input type="text" placeholder="Buscar" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-3 py-1.5 h-8 bg-background-tertiary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary w-48" />
                          </div>
                          <ColumnSelector settings={columnSettings} onSettingsChange={setColumnSettings} />
                        </div>
                      </div>
                      <button onClick={() => { setEditingTrade(null); setModalOpen(true); }} className="flex items-center gap-2 px-5 py-2 h-9 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 transition-all text-sm font-medium shadow-lg shadow-emerald-600/20">
                        <Plus className="w-4 h-4" />
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
                        <PositionsTable positions={positions} onRowClick={handleOpenPositionDetail} prices={prices} mepRate={mepRate} sortConfig={positionsSort} onSortChange={setPositionsSort} searchTerm={searchTerm} columnSettings={columnSettings} onColumnSettingsChange={setColumnSettings} />
                      )}
                    </div>
                  </div>

                  {/* Total Card - completamente separado de la tabla */}
                  {positions.length > 0 && (
                    <TotalCard totals={totals} columnSettings={columnSettings} />
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
      </div >
    </ErrorBoundary >
  );
}
