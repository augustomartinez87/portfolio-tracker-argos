import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Plus, Trash2, Edit2, Download, RefreshCw, X, ChevronDown, ChevronUp, Loader2, LogOut, LayoutDashboard, FileText, HelpCircle, Menu, PieChart, Search } from 'lucide-react';
import { CONSTANTS } from '../utils/constants';
import { formatARS, formatUSD, formatPercent, formatNumber } from '../utils/formatters';
import { isBonoPesos, isBonoHardDollar, getAssetClass } from '../hooks/useBondPrices';
import { parseARSNumber, parseDateDMY } from '../utils/parsers';
import { usePrices } from '../services/priceService';
import DistributionChart from '../components/DistributionChart';
import SummaryCard from '../components/common/SummaryCard';
import PositionsTable from '../components/dashboard/PositionsTable';
import ColumnSelector from '../components/dashboard/ColumnSelector';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { PortfolioSelector } from '../components/PortfolioSelector';
import { tradeService } from '../services/tradeService';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingFallback } from '../components/common/LoadingSpinner';
import TickerAutocomplete from '../components/common/TickerAutocomplete';
import TradeModal from '../components/modals/TradeModal';
import DeleteModal from '../components/modals/DeleteModal';
import logo from '../assets/logo.png';

const PositionDetailModal = lazy(() => import('../components/PositionDetailModal'));

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { currentPortfolio } = usePortfolio();

  const { prices, mepRate, tickers, lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();

  const lastUpdate = priceLastUpdate ? priceLastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null;
  const lastUpdateFull = priceLastUpdate ? priceLastUpdate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

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

  const sortedTrades = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return [];

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
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-tertiary">Cargando datos...</p>
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
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PortfolioSelector />
              <img src={logo} alt="Argos Capital" className="w-8 h-8 ml-2" />
              <h1 className="text-lg font-bold text-text-primary">Argos Capital</h1>
            </div>
            <button
              onClick={() => refetchPrices()}
              disabled={isPricesLoading}
              className="p-3 h-12 w-12 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title="Actualizar"
            >
              <RefreshCw className={`w-5 h-5 ${isPricesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

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

          <div className="flex-1 py-4 overflow-y-auto">
            <div className={`px-3 space-y-1 ${sidebarOpen ? '' : 'hidden'}`}>
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 h-10 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'}`}>
                <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">Dashboard</span>
              </button>

              <button onClick={() => setActiveTab('trades')} className={`w-full flex items-center gap-3 px-3 py-2.5 h-10 rounded-lg transition-colors ${activeTab === 'trades' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'}`}>
                <FileText className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">Transacciones</span>
              </button>

              <button onClick={() => setActiveTab('distribution')} className={`w-full flex items-center gap-3 px-3 py-2.5 h-10 rounded-lg transition-colors ${activeTab === 'distribution' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'}`}>
                <PieChart className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">Distribución</span>
              </button>

              <button onClick={() => setActiveTab('help')} className={`w-full flex items-center gap-3 px-3 py-2.5 h-10 rounded-lg transition-colors ${activeTab === 'help' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'}`}>
                <HelpCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">Ayuda</span>
              </button>
            </div>
          </div>

          <div className="p-3 border-t border-border-primary">
            <div className={`flex items-center gap-3 px-2 ${sidebarOpen ? '' : 'justify-center'}`}>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-sm">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{user?.email || 'Usuario'}</p>
                  <button onClick={() => signOut()} className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1">
                    <LogOut className="w-3 h-3" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'} mt-16 lg:mt-0`}>
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            <header className="hidden lg:flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PortfolioSelector />
                <img src={logo} alt="Argos Capital" className="w-8 h-8" />
                <h1 className="text-xl font-bold text-text-primary">Argos Capital</h1>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-text-tertiary">MEP: {formatNumber(mepRate, 0)}</span>
                <span className="text-text-tertiary">|</span>
                <span className="text-sm text-text-tertiary">{lastUpdate || '--:--'}</span>
                <button
                  onClick={() => refetchPrices()}
                  disabled={isPricesLoading}
                  className="ml-2 p-2 h-9 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Actualizar"
                >
                  <RefreshCw className={`w-4 h-4 ${isPricesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </header>

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
              <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border-primary flex flex-wrap gap-2 items-center justify-between">
                  <h2 className="text-lg font-semibold text-text-primary">Transacciones</h2>
                  <div className="flex gap-2">
                    <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary">
                      <Download className="w-3.5 h-3.5" />
                      Plantilla
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-xs font-medium border border-border-primary cursor-pointer">
                      <Download className="w-3.5 h-3.5" />
                      Importar
                      <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" disabled={isLoading} />
                    </label>
                    <button onClick={() => { setEditingTrade(null); setModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-xs font-medium">
                      <Plus className="w-3.5 h-3.5" />
                      Nuevo
                    </button>
                  </div>
                </div>

                {importStatus && (
                  <div className={`px-4 py-2 text-sm border-b ${importStatus.includes('Error') || importStatus.includes('error') ? 'bg-danger/10 text-danger border-danger/30' : importStatus.includes('importadas') ? 'bg-success/10 text-success border-success/30' : 'bg-background-tertiary text-text-secondary'}`}>
                    {importStatus}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-background-tertiary text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                        <th className="px-4 py-3 cursor-pointer hover:text-text-primary" onClick={() => handleSort('fecha')}>
                          <div className="flex items-center gap-1">Fecha {sortConfig.key === 'fecha' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:text-text-primary" onClick={() => handleSort('ticker')}>
                          <div className="flex items-center gap-1">Ticker {sortConfig.key === 'ticker' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:text-text-primary text-right" onClick={() => handleSort('cantidad')}>
                          <div className="flex items-center justify-end gap-1">Cantidad {sortConfig.key === 'cantidad' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:text-text-primary text-right" onClick={() => handleSort('precioCompra')}>
                          <div className="flex items-center justify-end gap-1">Precio {sortConfig.key === 'precioCompra' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                        </th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-primary">
                      {sortedTrades.length === 0 ? (
                        <tr><td colSpan="6" className="px-4 py-8 text-center text-text-tertiary text-sm">No hay transacciones registradas</td></tr>
                      ) : sortedTrades.map((trade, idx) => (
                        <tr key={trade.id || idx} className="hover:bg-background-tertiary/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">{trade.fecha}</td>
                          <td className="px-4 py-3 text-sm font-medium text-text-primary whitespace-nowrap">{trade.ticker}</td>
                          <td className={`px-4 py-3 text-sm text-right whitespace-nowrap font-mono ${trade.cantidad < 0 ? 'text-danger' : 'text-text-primary'}`}>{formatNumber(trade.cantidad, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-mono">{formatARS(trade.precioCompra)}</td>
                          <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-mono">{formatARS(Math.abs(trade.cantidad) * trade.precioCompra)}</td>
                          <td className="px-4 py-3 text-center">
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
            )}

            {activeTab === 'dashboard' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                  <SummaryCard title="Invertido" value={formatARS(totals.invertido)} subtitle="Total invertido" />
                  <SummaryCard title="Valuación" value={formatARS(totals.valuacion)} subtitle={lastUpdate ? `Actualizado: ${lastUpdate}` : ''} />
                  <SummaryCard title="Resultado" value={`${formatPercent(totals.resultadoPct)}`} subtitle={formatARS(totals.resultado)} positive={totals.resultado >= 0} />
                  <SummaryCard title="Hoy" value={`${formatPercent(totals.resultadoDiarioPct)}`} subtitle={formatARS(totals.resultadoDiario)} positive={totals.resultadoDiario >= 0} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-3 bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
                    <div className="p-3 lg:p-4 border-b border-border-primary flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base lg:text-lg font-semibold text-text-primary">Posiciones</h2>
                        <span className="text-xs text-text-tertiary bg-background-tertiary px-2 py-0.5 rounded-full">{positions.length}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                          <input type="text" placeholder="Buscar ticker..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-3 py-1.5 h-8 bg-background-tertiary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary w-32 lg:w-48" />
                        </div>
                        <ColumnSelector settings={columnSettings} onChange={setColumnSettings} />
                      </div>
                    </div>
                    <PositionsTable positions={positions} onRowClick={handleOpenPositionDetail} prices={prices} mepRate={mepRate} sortConfig={positionsSort} onSortChange={setPositionsSort} searchTerm={searchTerm} columnSettings={columnSettings} onColumnSettingsChange={setColumnSettings} />
                  </div>

                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
                      <h3 className="text-sm font-medium text-text-secondary mb-3">Resumen USD</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-text-tertiary">Invertido</span><span className="text-text-primary">{formatUSD(totals.invertidoUSD)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-text-tertiary">Valuación</span><span className="text-text-primary">{formatUSD(totals.valuacionUSD)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-text-tertiary">Resultado</span><span className={totals.resultadoUSD >= 0 ? 'text-success' : 'text-danger'}>{formatUSD(totals.resultadoUSD)}</span></div>
                      </div>
                    </div>

                    <button onClick={() => { setEditingTrade(null); setModalOpen(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 h-11 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/20">
                      <Plus className="w-5 h-5" />
                      Agregar Trade
                    </button>

                    <button onClick={downloadTemplate} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 h-10 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors text-sm font-medium border border-border-primary">
                      <Download className="w-4 h-4" />
                      Descargar Plantilla CSV
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        <TradeModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingTrade(null); }} onSave={handleSaveTrade} trade={editingTrade} tickers={tickers} />

        <DeleteModal isOpen={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setDeletingTrade(null); }} onConfirm={handleDeleteTrade} tradeTicker={deletingTrade?.ticker} />

        <Suspense fallback={<LoadingFallback />}>
          <PositionDetailModal isOpen={detailModalOpen} onClose={handleClosePositionDetail} position={selectedPosition} prices={prices} mepRate={mepRate} onTradeClick={(trade) => { const t = sortedTrades.find(st => st.id === trade.id); if (t) { setEditingTrade(t); setDetailModalOpen(false); setModalOpen(true); } }} />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
