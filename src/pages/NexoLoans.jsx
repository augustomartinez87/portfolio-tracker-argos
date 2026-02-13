import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Plus, RefreshCw } from 'lucide-react';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { SidebarToggleButton } from '@/components/common/SidebarToggleButton';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import SummaryCard from '@/components/common/SummaryCard';
import { formatUSDT, formatPercent, formatNumber } from '@/utils/formatters';
import { nexoLoanService } from '@/features/crypto/services/nexoLoanService';
import { cryptoPriceService } from '@/features/crypto/services/cryptoPriceService';
import { useNexoEngine } from '@/features/crypto/hooks/useNexoEngine';
import NexoLoansTable from '@/features/crypto/components/NexoLoansTable';
import NexoLoanModal from '@/features/crypto/components/NexoLoanModal';
import { CONSTANTS } from '@/utils/constants';

export default function NexoLoans() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentPortfolio } = usePortfolio();
  const [sidebarExpanded, setSidebarExpanded] = useSidebarState();

  const [loans, setLoans] = useState([]);
  const [prices, setPrices] = useState({});
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);

  const isCryptoPortfolio = currentPortfolio?.portfolio_type === 'cripto';

  // Auto-redirect if portfolio type doesn't match
  useEffect(() => {
    if (currentPortfolio && !isCryptoPortfolio) {
      navigate('/portfolio/dashboard');
    }
  }, [currentPortfolio, isCryptoPortfolio, navigate]);

  // Unique collateral asset IDs from all loans
  const collateralAssetIds = useMemo(() => {
    if (!loans.length) return [];
    return Array.from(new Set(
      loans.filter(l => l.status === 'active' && l.collateral_asset)
        .map(l => l.collateral_asset)
    ));
  }, [loans]);

  // Engine: real-time LTV calculations
  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active'), [loans]);
  const engine = useNexoEngine(activeLoans, prices);

  // Load loans
  const loadLoans = useCallback(async () => {
    if (!currentPortfolio?.id || !isCryptoPortfolio) {
      setLoans([]);
      return;
    }
    setLoadingLoans(true);
    try {
      const data = await nexoLoanService.getLoans(currentPortfolio.id);
      setLoans(data);
    } catch (err) {
      console.error('Error loading loans:', err);
    } finally {
      setLoadingLoans(false);
    }
  }, [currentPortfolio, isCryptoPortfolio]);

  // Load collateral prices
  const loadPrices = useCallback(async () => {
    if (!collateralAssetIds.length) {
      setPrices({});
      return;
    }
    setLoadingPrices(true);
    try {
      const data = await cryptoPriceService.getPrices(collateralAssetIds, 'usdt');
      // Map to simple { assetId: priceUSDT }
      const priceMap = {};
      for (const [id, info] of Object.entries(data)) {
        priceMap[id] = info?.usdt || info?.usd || 0;
      }
      setPrices(priceMap);
    } catch (err) {
      console.error('Error loading collateral prices:', err);
    } finally {
      setLoadingPrices(false);
    }
  }, [collateralAssetIds]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, CONSTANTS.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadPrices]);

  // Handlers
  const handleSaveLoan = useCallback(async (formData) => {
    if (!currentPortfolio || !user) return;
    const userId = currentPortfolio.user_id || user.id;

    if (formData.id) {
      await nexoLoanService.updateLoan(formData.id, {
        outstanding: formData.outstanding,
        interest_rate_apr: formData.interest_rate_apr,
        collateral_asset: formData.collateral_asset,
        collateral_quantity: formData.collateral_quantity,
        ltv_warning: formData.ltv_warning,
        ltv_liquidation: formData.ltv_liquidation,
      });
    } else {
      await nexoLoanService.createLoan(currentPortfolio.id, userId, formData);
    }

    await loadLoans();
    setEditingLoan(null);
  }, [currentPortfolio, user, loadLoans]);

  const handleCloseLoan = useCallback(async (loan) => {
    if (!confirm(`Cerrar prestamo de ${formatUSDT(loan.outstanding)}? Esto marca la deuda como saldada.`)) return;
    try {
      await nexoLoanService.closeLoan(loan.id);
      await loadLoans();
    } catch (err) {
      alert('Error cerrando prestamo: ' + err.message);
    }
  }, [loadLoans]);

  const handleDeleteLoan = useCallback(async (loan) => {
    if (!confirm('Eliminar este prestamo permanentemente?')) return;
    try {
      await nexoLoanService.deleteLoan(loan.id);
      await loadLoans();
    } catch (err) {
      alert('Error eliminando prestamo: ' + err.message);
    }
  }, [loadLoans]);

  const handleRefresh = useCallback(() => {
    loadLoans();
    loadPrices();
  }, [loadLoans, loadPrices]);

  const isLoading = loadingLoans || loadingPrices;

  // BTC price for display
  const btcPrice = prices.bitcoin || 0;

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
            title="Prestamos Nexo"
            subtitle="Colateral, deuda y riesgo en tiempo real"
            icon={Landmark}
            loading={isLoading}
            onRefresh={handleRefresh}
            sidebarToggle={<SidebarToggleButton isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />}
          />

          {!currentPortfolio ? (
            <PortfolioEmptyState title="Sin Portfolio" message="Selecciona o crea un portfolio cripto para comenzar." />
          ) : !isCryptoPortfolio ? (
            <PortfolioEmptyState title="Portfolio no cripto" message="Selecciona un portfolio de tipo cripto." />
          ) : (
            <>
              {/* Summary Cards */}
              {activeLoans.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <SummaryCard
                    title="Deuda Total"
                    value={formatUSDT(engine.totalOutstanding)}
                  />
                  <SummaryCard
                    title="Colateral"
                    value={formatUSDT(engine.totalCollateralUSDT)}
                  />
                  <SummaryCard
                    title="LTV"
                    value={formatPercent(engine.ltvPonderado * 100).replace('+', '')}
                    trend={engine.ltvPonderado > 0.65 ? -1 : 1}
                  />
                  <SummaryCard
                    title="Costo/Dia"
                    value={formatUSDT(engine.dailyCostTotal)}
                  />
                  <SummaryCard
                    title="Costo/Ano"
                    value={formatUSDT(engine.annualCostTotal)}
                  />
                  <SummaryCard
                    title="BTC Price"
                    value={formatUSDT(btcPrice)}
                  />
                </div>
              )}

              {/* Risk banner */}
              {engine.worstRiskLevel === 'danger' && (
                <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-danger animate-pulse" />
                  <p className="text-danger text-sm font-medium">
                    ATENCION: LTV en zona de liquidacion. Considera agregar colateral o repagar deuda.
                  </p>
                </div>
              )}
              {engine.worstRiskLevel === 'warning' && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-warning animate-pulse" />
                  <p className="text-warning text-sm font-medium">
                    LTV acercandose al threshold de alerta. Monitorea de cerca.
                  </p>
                </div>
              )}

              {/* Action bar */}
              <div className="flex justify-end">
                <button
                  onClick={() => { setEditingLoan(null); setModalOpen(true); }}
                  className="flex items-center gap-2 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo Prestamo
                </button>
              </div>

              {/* Loans table */}
              <NexoLoansTable
                loanMetrics={engine.loans}
                onEdit={(loan) => { setEditingLoan(loan); setModalOpen(true); }}
                onClose={handleCloseLoan}
                onDelete={handleDeleteLoan}
              />
            </>
          )}
        </div>
      </main>

      <MobileNav portfolioType={currentPortfolio?.portfolio_type} />

      <Suspense fallback={null}>
        <NexoLoanModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingLoan(null); }}
          onSave={handleSaveLoan}
          loan={editingLoan}
        />
      </Suspense>
    </div>
  );
}
