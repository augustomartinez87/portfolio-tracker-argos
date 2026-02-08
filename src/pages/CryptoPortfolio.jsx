import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Plus, BarChart3, List } from 'lucide-react';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { SidebarToggleButton } from '@/components/common/SidebarToggleButton';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import SummaryCard from '@/components/common/SummaryCard';
import { formatUSDT, formatPercent } from '@/utils/formatters';
import { tradeService } from '@/features/portfolio/services/tradeService';
import { cryptoPriceService } from '@/features/crypto/services/cryptoPriceService';
import { useCryptoPortfolioEngine } from '@/features/crypto/hooks/useCryptoPortfolioEngine';
import CryptoPositionsTable from '@/features/crypto/components/CryptoPositionsTable';
import CryptoTradesTable from '@/features/crypto/components/CryptoTradesTable';
import CryptoTradeModal from '@/features/crypto/components/CryptoTradeModal';
import CryptoPositionDetailModal from '@/features/crypto/components/CryptoPositionDetailModal';
import { TRANSACTION_TYPES } from '@/constants';
import { CONSTANTS } from '@/utils/constants';

export default function CryptoPortfolio() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentPortfolio } = usePortfolio();
  const [sidebarExpanded, setSidebarExpanded] = useSidebarState();

  const [activeTab, setActiveTab] = useState('resumen');
  const [trades, setTrades] = useState([]);
  const [prices, setPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const isCryptoPortfolio = currentPortfolio?.portfolio_type === 'cripto';

  // Auto-redirect if portfolio type doesn't match this page
  useEffect(() => {
    if (currentPortfolio && !isCryptoPortfolio) {
      navigate('/portfolio/dashboard');
    }
  }, [currentPortfolio, isCryptoPortfolio, navigate]);

  const assetIds = useMemo(() => {
    if (!isCryptoPortfolio) return [];
    return Array.from(new Set(
      trades.map(t => cryptoPriceService.resolveId(t.ticker || '')).filter(Boolean)
    ));
  }, [trades, isCryptoPortfolio]);

  const { positions, totals } = useCryptoPortfolioEngine(trades, prices);

  const loadTrades = useCallback(async () => {
    if (!currentPortfolio?.id || !isCryptoPortfolio) {
      setTrades([]);
      return;
    }
    const data = await tradeService.getTrades(currentPortfolio.id);
    setTrades(data || []);
  }, [currentPortfolio, isCryptoPortfolio]);

  const loadPrices = useCallback(async () => {
    if (!isCryptoPortfolio || !assetIds.length) {
      setPrices({});
      return;
    }
    setLoadingPrices(true);
    try {
      const data = await cryptoPriceService.getPrices(assetIds, 'usdt');
      setPrices(data || {});
    } catch (err) {
      console.error('Error loading crypto prices:', err);
    } finally {
      setLoadingPrices(false);
    }
  }, [assetIds]);

  useEffect(() => {
    loadTrades();
    setPrices({});
  }, [loadTrades, currentPortfolio?.id]);

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, CONSTANTS.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadPrices]);

  const handleSaveTrade = useCallback(async (trade) => {
    if (!currentPortfolio || !user) return;

    const userId = currentPortfolio.user_id || user.id;
    const isSell = trade.type === TRANSACTION_TYPES.SELL;
    const normalizedId = cryptoPriceService.resolveId(trade.ticker);

    try {
      if (editingTrade) {
        await tradeService.updateTrade(trade.id, {
          ticker: normalizedId,
          trade_type: isSell ? 'sell' : 'buy',
          quantity: Math.abs(trade.quantity),
          price: trade.price,
          total_amount: Math.abs(trade.quantity) * trade.price,
          currency: 'USDT',
          trade_date: trade.date
        });
      } else {
        await tradeService.createTrade(currentPortfolio.id, userId, {
          ticker: normalizedId,
          trade_type: isSell ? 'sell' : 'buy',
          quantity: Math.abs(trade.quantity),
          price: trade.price,
          total_amount: Math.abs(trade.quantity) * trade.price,
          currency: 'USDT',
          trade_date: trade.date
        });
      }

      await loadTrades();
      setTradeModalOpen(false);
      setEditingTrade(null);
    } catch (error) {
      console.error('Error saving crypto trade:', error);
      alert('Error al guardar la transaccion: ' + error.message);
    }
  }, [currentPortfolio, user, editingTrade, loadTrades]);

  const handleDeleteTrade = useCallback(async (trade) => {
    if (!trade?.id) return;
    if (!confirm('Eliminar esta transaccion?')) return;
    try {
      await tradeService.deleteTrade(trade.id);
      await loadTrades();
    } catch (error) {
      console.error('Error deleting crypto trade:', error);
      alert('Error al eliminar la transaccion: ' + error.message);
    }
  }, [loadTrades]);

  const handleOpenPositionDetail = useCallback((position) => {
    setSelectedPosition(position);
    setDetailModalOpen(true);
  }, []);

  const handleClosePositionDetail = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedPosition(null);
  }, []);

  const tradesForSelected = useMemo(() => {
    if (!selectedPosition?.assetId) return [];
    const id = String(selectedPosition.assetId).toLowerCase();
    return trades.filter(t => String(t.ticker || '').toLowerCase() === id);
  }, [trades, selectedPosition]);

  return (
    <div className="min-h-screen bg-background-primary flex">
      <DashboardSidebar
        user={user}
        signOut={signOut}
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
        portfolioType={currentPortfolio?.portfolio_type}
      />

      <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-x-hidden ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
        <div className="p-3 lg:p-4 space-y-3">
          <PageHeader
            title="Portfolio Cripto"
            subtitle="Compras, ventas y posiciones"
            icon={Wallet}
            loading={loadingPrices}
            onRefresh={loadPrices}
            sidebarToggle={<SidebarToggleButton isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />}
          />

          {!currentPortfolio ? (
            <PortfolioEmptyState title="Sin Portfolio" message="Selecciona o crea un portfolio cripto para comenzar." />
          ) : !isCryptoPortfolio ? (
            <PortfolioEmptyState title="Portfolio no cripto" message="Selecciona un portfolio de tipo cripto para usar este modulo." />
          ) : (
            <>
              {/* Tabs primero - igual que Dashboard bursátil */}
              <div className="border-b border-border-secondary">
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('resumen')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'resumen'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Resumen
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('trades')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'trades'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <List className="w-4 h-4" />
                      Transacciones
                    </span>
                  </button>
                </div>
              </div>

              {/* Contenido de cada tab */}
              {activeTab === 'resumen' ? (
                <div className="space-y-3">
                  {/* Summary Cards dentro del tab resumen - igual que Dashboard */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SummaryCard title="Invertido" value={formatUSDT(totals.invested)} />
                    <SummaryCard title="Valuacion" value={formatUSDT(totals.valuation)} />
                    <SummaryCard
                      title="P&L"
                      value={formatUSDT(totals.pnl)}
                      trend={totals.pnl}
                      showBadge
                      badgeValue={formatPercent(totals.pnlPct)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => { setEditingTrade(null); setTradeModalOpen(true); }}
                      className="flex items-center gap-2 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nueva Transaccion
                    </button>
                  </div>
                  <CryptoPositionsTable positions={positions} onRowClick={handleOpenPositionDetail} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setEditingTrade(null); setTradeModalOpen(true); }}
                      className="flex items-center gap-2 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nueva Transaccion
                    </button>
                  </div>
                  <CryptoTradesTable
                    trades={trades}
                    onEdit={(t) => { setEditingTrade(t); setTradeModalOpen(true); }}
                    onDelete={handleDeleteTrade}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <MobileNav portfolioType={currentPortfolio?.portfolio_type} />

      <Suspense fallback={null}>
        <CryptoTradeModal
          isOpen={tradeModalOpen}
          onClose={() => { setTradeModalOpen(false); setEditingTrade(null); }}
          onSave={handleSaveTrade}
          trade={editingTrade}
        />
        <CryptoPositionDetailModal
          open={detailModalOpen}
          onClose={handleClosePositionDetail}
          position={selectedPosition}
          trades={tradesForSelected}
          onEditTrade={(t) => { setEditingTrade(t); setTradeModalOpen(true); }}
          onDeleteTrade={handleDeleteTrade}
        />
      </Suspense>
    </div>
  );
}
