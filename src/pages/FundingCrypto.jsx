import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bitcoin, LayoutDashboard, ArrowLeftRight, Plus,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw,
} from 'lucide-react';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { SidebarToggleButton } from '@/components/common/SidebarToggleButton';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import SummaryCard from '@/components/common/SummaryCard';
import { formatARS, formatUSDT, formatPercent, formatNumber } from '@/utils/formatters';
import { nexoLoanService } from '@/features/crypto/services/nexoLoanService';
import { cryptoPriceService } from '@/features/crypto/services/cryptoPriceService';
import { fciService } from '@/features/fci/services/fciService';
import { useCryptoFundingEngine } from '@/features/crypto/hooks/useCryptoFundingEngine';
import { fundingCycleService } from '@/features/crypto/services/fundingCycleService';
import { useFundingCycleEngine } from '@/features/crypto/hooks/useFundingCycleEngine';
import ConversionModal from '@/features/crypto/components/ConversionModal';
import ConversionsTable from '@/features/crypto/components/ConversionsTable';
import CycleCard from '@/features/crypto/components/CycleCard';
import CycleModal from '@/features/crypto/components/CycleModal';
import CycleDetailView from '@/features/crypto/components/CycleDetailView';
import { CONSTANTS } from '@/utils/constants';

// ============================================================
// Flow Diagram Component
// ============================================================
function FlowDiagram({ engine }) {
  const steps = [
    {
      label: 'BTC Colateral',
      value: formatUSDT(engine.totalCollateralUSDT),
      sub: `LTV ${formatNumber(engine.ltvPonderado * 100, 1)}%`,
      color: 'text-warning',
      bgColor: 'bg-warning/10 border-warning/20',
    },
    {
      label: 'Prestamo USDT',
      value: formatUSDT(engine.totalOutstandingUSDT),
      sub: `APR ${formatNumber(engine.aprPromedio * 100, 2)}%`,
      color: 'text-danger',
      bgColor: 'bg-danger/10 border-danger/20',
    },
    {
      label: 'Conversion',
      value: formatARS(engine.totalConvertidoARS),
      sub: `TC ${formatNumber(engine.tcPromedioConversiones, 2)} → ${formatNumber(engine.tcActual, 2)}`,
      color: 'text-primary',
      bgColor: 'bg-primary/10 border-primary/20',
    },
    {
      label: 'FCI (ARS)',
      value: formatARS(engine.fciValuacionARS),
      sub: `TNA ${formatNumber(engine.fciTnaAnual * 100, 2)}%`,
      color: 'text-success',
      bgColor: 'bg-success/10 border-success/20',
    },
  ];

  return (
    <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
      <h3 className="text-xs font-semibold text-text-tertiary uppercase mb-3">Flujo del Ciclo</h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className={`flex-1 min-w-[120px] p-3 rounded-lg border ${step.bgColor} text-center`}>
              <p className={`text-[10px] font-semibold uppercase ${step.color}`}>{step.label}</p>
              <p className="text-sm font-mono font-bold text-text-primary mt-1">{step.value}</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">{step.sub}</p>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Carry Comparison Card
// ============================================================
function CarryComparisonCard({ engine }) {
  const isPositive = engine.carryPositivo;
  return (
    <div className={`rounded-xl border p-4 ${isPositive ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase">Carry Spread</h3>
        {isPositive
          ? <TrendingUp className="w-4 h-4 text-success" />
          : <TrendingDown className="w-4 h-4 text-danger" />
        }
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-[10px] text-text-tertiary uppercase mb-1">Rendimiento FCI</p>
          <p className="text-lg font-mono font-bold text-success">
            {formatARS(engine.rendimientoDiarioARS)}
          </p>
          <p className="text-[10px] text-text-tertiary">/dia</p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary uppercase mb-1">Costo Nexo</p>
          <p className="text-lg font-mono font-bold text-danger">
            {formatARS(engine.costoDiarioARS)}
          </p>
          <p className="text-[10px] text-text-tertiary">/dia</p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary uppercase mb-1">Spread Neto</p>
          <p className={`text-lg font-mono font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
            {formatARS(engine.carrySpreadDiarioARS)}
          </p>
          <p className="text-[10px] text-text-tertiary">/dia</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border-primary flex justify-between text-xs">
        <span className="text-text-tertiary">Spread anualizado</span>
        <span className={`font-mono font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>
          {formatPercent(engine.carrySpreadAnualPct)}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function FundingCrypto() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentPortfolio, fciLotEngine, mepRate } = usePortfolio();
  const [sidebarExpanded, setSidebarExpanded] = useSidebarState();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loans, setLoans] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [collateralPrices, setCollateralPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [convModalOpen, setConvModalOpen] = useState(false);

  // Cycles state
  const [cycles, setCycles] = useState([]);
  const [cyclesWithChildren, setCyclesWithChildren] = useState([]);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState(null);
  const [expandedCycleId, setExpandedCycleId] = useState(null);

  const isCryptoPortfolio = currentPortfolio?.portfolio_type === 'cripto';

  useEffect(() => {
    if (currentPortfolio && !isCryptoPortfolio) {
      navigate('/portfolio/dashboard');
    }
  }, [currentPortfolio, isCryptoPortfolio, navigate]);

  // FCI data from context (shared, not modified)
  const fciPositions = fciLotEngine?.positions || [];
  const fciTotals = fciLotEngine?.totals || { invested: 0, valuation: 0, pnl: 0, pnlPct: 0 };

  // TNA FCI from latest VCP prices (same logic as FundingEngine bursatil)
  const [vcpHistoricos, setVcpHistoricos] = useState([]);
  const mainFciId = useMemo(() => {
    if (!fciPositions.length) return null;
    if (fciPositions.length === 1) return fciPositions[0].fciId;
    return fciPositions.reduce((max, c) => c.valuation > max.valuation ? c : max).fciId;
  }, [fciPositions]);

  const tnaFCI = useMemo(() => {
    if (vcpHistoricos.length < 2) return 0;
    const ultimo = vcpHistoricos[vcpHistoricos.length - 1];
    const penultimo = vcpHistoricos[vcpHistoricos.length - 2];
    if (!ultimo.vcp || !penultimo.vcp || penultimo.vcp === 0) return 0;
    const dias = Math.round((new Date(ultimo.fecha) - new Date(penultimo.fecha)) / 86400000);
    if (dias <= 0) return 0;
    return Math.pow(ultimo.vcp / penultimo.vcp, 365 / dias) - 1;
  }, [vcpHistoricos]);

  // Load VCP history for TNA calc
  useEffect(() => {
    if (!mainFciId) return;
    (async () => {
      try {
        const prices = await fciService.getPrices(mainFciId);
        if (prices?.length) {
          const sorted = prices
            .map(p => ({ fecha: p.fecha, vcp: Number(p.vcp) }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
          setVcpHistoricos(sorted);
        }
      } catch (err) {
        console.error('Error loading VCP history:', err);
      }
    })();
  }, [mainFciId]);

  // Load loans
  const loadLoans = useCallback(async () => {
    if (!currentPortfolio?.id || !isCryptoPortfolio) return;
    try {
      const data = await nexoLoanService.getActiveLoans(currentPortfolio.id);
      setLoans(data);
    } catch (err) {
      console.error('Error loading loans:', err);
    }
  }, [currentPortfolio, isCryptoPortfolio]);

  // Load conversions
  const loadConversions = useCallback(async () => {
    if (!currentPortfolio?.id || !isCryptoPortfolio) return;
    try {
      const data = await nexoLoanService.getConversions(currentPortfolio.id);
      setConversions(data);
    } catch (err) {
      console.error('Error loading conversions:', err);
    }
  }, [currentPortfolio, isCryptoPortfolio]);

  // Load cycles
  const loadCycles = useCallback(async () => {
    if (!currentPortfolio?.id || !isCryptoPortfolio) return;
    try {
      const data = await fundingCycleService.getCycles(currentPortfolio.id);
      setCycles(data);
      // Load children for each cycle
      const withChildren = await Promise.all(
        data.map(c => fundingCycleService.getCycleWithChildren(c.id))
      );
      setCyclesWithChildren(withChildren);
    } catch (err) {
      console.error('Error loading cycles:', err);
    }
  }, [currentPortfolio, isCryptoPortfolio]);

  // Load collateral prices
  const collateralAssetIds = useMemo(() => {
    return Array.from(new Set(
      loans.filter(l => l.collateral_asset).map(l => l.collateral_asset)
    ));
  }, [loans]);

  const loadPrices = useCallback(async () => {
    if (!collateralAssetIds.length) return;
    try {
      const data = await cryptoPriceService.getPrices(collateralAssetIds, 'usdt');
      const map = {};
      for (const [id, info] of Object.entries(data)) {
        map[id] = info?.usdt || info?.usd || 0;
      }
      setCollateralPrices(map);
    } catch (err) {
      console.error('Error loading prices:', err);
    }
  }, [collateralAssetIds]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadLoans(), loadConversions(), loadCycles()]).finally(() => setLoading(false));
  }, [loadLoans, loadConversions, loadCycles]);

  // Price refresh
  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, CONSTANTS.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadPrices]);

  // Engine (global dashboard)
  const engine = useCryptoFundingEngine({
    loans,
    collateralPrices,
    fciPositions,
    fciTotals,
    tnaFci: tnaFCI,
    conversions,
    mepRate: mepRate || 1,
  });

  // Lot valuations map for cycle engine
  const lotValuations = useMemo(() => {
    const map = {};
    const lotDetails = fciLotEngine?.lotDetails || [];
    for (const lot of lotDetails) {
      map[lot.id] = {
        lotId: lot.id,
        valuation: lot.valuation || lot.capital_invertido || 0,
        pnl: lot.pnl || 0,
      };
    }
    return map;
  }, [fciLotEngine]);

  // Cycle engine
  const cycleEngine = useFundingCycleEngine({
    cyclesWithChildren,
    lotValuations,
    tcActual: mepRate || 1,
  });

  // Handlers
  const handleSaveConversion = useCallback(async (data) => {
    if (!currentPortfolio || !user) return;
    await nexoLoanService.createConversion(
      currentPortfolio.id,
      currentPortfolio.user_id || user.id,
      data
    );
    await loadConversions();
  }, [currentPortfolio, user, loadConversions]);

  const handleDeleteConversion = useCallback(async (conv) => {
    if (!confirm('Eliminar esta conversion?')) return;
    try {
      await nexoLoanService.deleteConversion(conv.id);
      await loadConversions();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }, [loadConversions]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadLoans(), loadConversions(), loadPrices(), loadCycles()]);
    setLoading(false);
  }, [loadLoans, loadConversions, loadPrices, loadCycles]);

  // Cycle handlers
  const handleSaveCycle = useCallback(async (data) => {
    if (!currentPortfolio || !user) return;
    if (data.id) {
      await fundingCycleService.updateCycle(data.id, {
        label: data.label,
        loan_id: data.loan_id,
        notes: data.notes,
      });
    } else {
      await fundingCycleService.createCycle(
        currentPortfolio.id,
        currentPortfolio.user_id || user.id,
        data
      );
    }
    await loadCycles();
  }, [currentPortfolio, user, loadCycles]);

  const handleEditCycle = useCallback((metrics) => {
    const cycle = cycles.find(c => c.id === metrics.cycleId);
    if (cycle) {
      setEditingCycle(cycle);
      setCycleModalOpen(true);
    }
  }, [cycles]);

  const handleCloseCycle = useCallback(async (metrics) => {
    if (!confirm(`Cerrar el ciclo "${metrics.label}"? Se guardara un snapshot de las metricas actuales.`)) return;
    try {
      await fundingCycleService.closeCycle(metrics.cycleId, {
        pnlNominalARS: metrics.pnlNominalARS,
        pnlRealARS: metrics.pnlRealARS,
        roiPct: metrics.roiPct,
        tcPromedio: metrics.tcPromedio,
        dias: metrics.diasEnCiclo,
      });
      await loadCycles();
    } catch (err) {
      alert('Error cerrando ciclo: ' + err.message);
    }
  }, [loadCycles]);

  const handleDeleteCycle = useCallback(async (metrics) => {
    if (!confirm(`Eliminar el ciclo "${metrics.label}"? Las conversiones y lotes vinculados NO se eliminaran, solo se desvincularan.`)) return;
    try {
      await fundingCycleService.deleteCycle(metrics.cycleId);
      setExpandedCycleId(null);
      await loadCycles();
    } catch (err) {
      alert('Error eliminando ciclo: ' + err.message);
    }
  }, [loadCycles]);

  const handleToggleExpand = useCallback((cycleId) => {
    setExpandedCycleId(prev => prev === cycleId ? null : cycleId);
  }, []);

  const hasData = loans.length > 0 || conversions.length > 0 || cycles.length > 0;

  return (
    <div className="min-h-screen bg-background-primary flex">
      <DashboardSidebar
        user={user}
        signOut={signOut}
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
        portfolioType={currentPortfolio?.portfolio_type}
      />

      <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-x-hidden mb-16 lg:mb-0 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
        <div className="p-3 lg:p-4 space-y-3">
          <PageHeader
            title="Funding Crypto"
            subtitle="BTC → Nexo → USDT → ARS → FCI"
            icon={Bitcoin}
            loading={loading}
            onRefresh={handleRefresh}
            sidebarToggle={<SidebarToggleButton isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />}
          />

          {!currentPortfolio ? (
            <PortfolioEmptyState title="Sin Portfolio" message="Selecciona o crea un portfolio cripto para comenzar." />
          ) : !isCryptoPortfolio ? (
            <PortfolioEmptyState title="Portfolio no cripto" message="Selecciona un portfolio de tipo cripto." />
          ) : !hasData ? (
            <div className="bg-background-secondary border border-border-primary rounded-xl p-8 text-center space-y-3">
              <Bitcoin className="w-12 h-12 text-text-tertiary mx-auto" />
              <h3 className="text-lg font-semibold text-text-primary">Sin datos de funding</h3>
              <p className="text-text-secondary text-sm max-w-md mx-auto">
                Crea un prestamo en <span className="text-primary font-medium">Prestamos Nexo</span> y registra conversiones USDT→ARS para ver las metricas de carry trade.
              </p>
              <button
                onClick={() => setConvModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Registrar Conversion
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="border-b border-border-secondary">
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'dashboard'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('conversiones')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'conversiones'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4" />
                      Conversiones
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('ciclos')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'ciclos'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Ciclos
                    </span>
                  </button>
                </div>
              </div>

              {/* Dashboard tab */}
              {activeTab === 'dashboard' && (
                <div className="space-y-3">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <SummaryCard
                      title="P&L Real"
                      value={formatARS(engine.pnlCicloARS)}
                      trend={engine.pnlCicloARS}
                      showBadge
                      badgeValue={engine.diasEnCiclo > 0 ? `${engine.diasEnCiclo}d` : '-'}
                    />
                    <SummaryCard
                      title="ROI Ciclo"
                      value={formatPercent(engine.roiCicloPct)}
                      trend={engine.roiCicloPct}
                    />
                    <SummaryCard
                      title="Exp. Cambiaria"
                      value={formatARS(Math.abs(engine.exposicionCambiariaARS))}
                      trend={-engine.exposicionCambiariaARS}
                    />
                    <SummaryCard
                      title="Carry Diario"
                      value={formatARS(engine.carrySpreadDiarioARS)}
                      trend={engine.carrySpreadDiarioARS}
                    />
                    <SummaryCard
                      title="Deuda Nexo"
                      value={formatUSDT(engine.totalOutstandingUSDT)}
                    />
                    <SummaryCard
                      title="LTV"
                      value={`${formatNumber(engine.ltvPonderado * 100, 1)}%`}
                      trend={engine.ltvPonderado > 0.65 ? -1 : 1}
                    />
                  </div>

                  {/* Flow diagram */}
                  <FlowDiagram engine={engine} />

                  {/* Carry comparison */}
                  <CarryComparisonCard engine={engine} />

                  {/* Currency Risk Card */}
                  {engine.cantidadConversiones > 0 && (
                    <div className={`rounded-xl border p-4 ${engine.exposicionCambiariaARS > 0 ? 'bg-danger/5 border-danger/20' : 'bg-success/5 border-success/20'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-text-tertiary uppercase">Riesgo Cambiario</h3>
                        <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${engine.variacionTCPct > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                          TC {engine.variacionTCPct > 0 ? '+' : ''}{formatNumber(engine.variacionTCPct, 2)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase mb-1">TC Venta</p>
                          <p className="text-lg font-mono font-bold text-text-primary">
                            {formatNumber(engine.tcPromedioConversiones, 2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase mb-1">TC Actual (MEP)</p>
                          <p className={`text-lg font-mono font-bold ${engine.variacionTCPct > 0 ? 'text-danger' : 'text-success'}`}>
                            {formatNumber(engine.tcActual, 2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase mb-1">Costo Recompra</p>
                          <p className="text-lg font-mono font-bold text-text-primary">
                            {formatARS(engine.costoRecompraARS)}
                          </p>
                          <p className="text-[10px] text-text-tertiary">{formatUSDT(engine.totalOutstandingUSDT)} a TC actual</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase mb-1">
                            {engine.exposicionCambiariaARS > 0 ? 'Perdida Cambiaria' : 'Ganancia Cambiaria'}
                          </p>
                          <p className={`text-lg font-mono font-bold ${engine.exposicionCambiariaARS > 0 ? 'text-danger' : 'text-success'}`}>
                            {formatARS(Math.abs(engine.exposicionCambiariaARS))}
                          </p>
                          <p className="text-[10px] text-text-tertiary">
                            {engine.exposicionCambiariaARS > 0
                              ? 'TC subio, recompra mas cara'
                              : 'TC bajo, recompra mas barata'}
                          </p>
                        </div>
                      </div>
                      {/* P&L breakdown */}
                      <div className="mt-3 pt-3 border-t border-border-primary grid grid-cols-3 gap-4 text-center text-xs">
                        <div>
                          <span className="text-text-tertiary">P&L Nominal</span>
                          <p className={`font-mono font-medium mt-0.5 ${engine.pnlCicloNominalARS >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatARS(engine.pnlCicloNominalARS)}
                          </p>
                          <span className="text-[10px] text-text-tertiary">FCI - intereses</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary">Efecto TC</span>
                          <p className={`font-mono font-medium mt-0.5 ${engine.exposicionCambiariaARS > 0 ? 'text-danger' : 'text-success'}`}>
                            {engine.exposicionCambiariaARS > 0 ? '-' : '+'}{formatARS(Math.abs(engine.exposicionCambiariaARS))}
                          </p>
                          <span className="text-[10px] text-text-tertiary">variacion TC</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary font-semibold">P&L Real</span>
                          <p className={`font-mono font-bold mt-0.5 ${engine.pnlCicloARS >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatARS(engine.pnlCicloARS)}
                          </p>
                          <span className="text-[10px] text-text-tertiary">neto de todo</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed metrics */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Cost side */}
                    <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-danger uppercase mb-3">Lado Costo (Nexo)</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Deuda total</span>
                          <span className="font-mono text-text-primary">{formatUSDT(engine.totalOutstandingUSDT)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">APR ponderado</span>
                          <span className="font-mono text-text-primary">{formatNumber(engine.aprPromedio * 100, 2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Costo diario (USDT)</span>
                          <span className="font-mono text-danger">{formatUSDT(engine.costoDiarioUSDT)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Costo diario (ARS)</span>
                          <span className="font-mono text-danger">{formatARS(engine.costoDiarioARS)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Costo anual (USDT)</span>
                          <span className="font-mono text-danger">{formatUSDT(engine.costoAnualUSDT)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border-primary pt-2">
                          <span className="text-text-tertiary">Colateral</span>
                          <span className="font-mono text-text-primary">{formatUSDT(engine.totalCollateralUSDT)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">LTV ponderado</span>
                          <span className={`font-mono font-medium ${engine.ltvPonderado > 0.65 ? 'text-danger' : 'text-success'}`}>
                            {formatNumber(engine.ltvPonderado * 100, 2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Yield side */}
                    <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
                      <h3 className="text-xs font-semibold text-success uppercase mb-3">Lado Rendimiento (FCI)</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Valuacion FCI</span>
                          <span className="font-mono text-text-primary">{formatARS(engine.fciValuacionARS)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">TNA estimada</span>
                          <span className="font-mono text-text-primary">{formatNumber(engine.fciTnaAnual * 100, 2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Rendimiento diario</span>
                          <span className="font-mono text-success">{formatARS(engine.rendimientoDiarioARS)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">P&L FCI diario real</span>
                          <span className="font-mono text-success">{formatARS(engine.fciPnlDiarioARS)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border-primary pt-2">
                          <span className="text-text-tertiary">Total convertido</span>
                          <span className="font-mono text-text-primary">{formatUSDT(engine.totalConvertidoUSDT)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">TC promedio venta</span>
                          <span className="font-mono text-text-primary">{formatNumber(engine.tcPromedioConversiones, 2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">TC actual (MEP)</span>
                          <span className={`font-mono font-medium ${engine.variacionTCPct > 0 ? 'text-danger' : 'text-success'}`}>
                            {formatNumber(engine.tcActual, 2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Conversiones tab */}
              {activeTab === 'conversiones' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setConvModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nueva Conversion
                    </button>
                  </div>
                  <ConversionsTable
                    conversions={conversions}
                    onDelete={handleDeleteConversion}
                  />
                </div>
              )}

              {/* Ciclos tab */}
              {activeTab === 'ciclos' && (
                <div className="space-y-3">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <SummaryCard
                      title="Ciclos Activos"
                      value={String(cycleEngine.ciclosActivos)}
                    />
                    <SummaryCard
                      title="P&L Total"
                      value={formatARS(cycleEngine.totalPnlRealARS)}
                      trend={cycleEngine.totalPnlRealARS}
                    />
                    <SummaryCard
                      title="ROI Promedio"
                      value={formatPercent(cycleEngine.avgRoiPct)}
                      trend={cycleEngine.avgRoiPct}
                    />
                    <SummaryCard
                      title="Ciclos Cerrados"
                      value={String(cycleEngine.ciclosCerrados)}
                    />
                  </div>

                  {/* New cycle button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setEditingCycle(null); setCycleModalOpen(true); }}
                      className="flex items-center gap-2 px-4 py-1.5 h-8 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nuevo Ciclo
                    </button>
                  </div>

                  {/* Cycle list */}
                  {cycleEngine.metrics.length === 0 ? (
                    <div className="bg-background-secondary border border-border-primary rounded-xl p-8 text-center">
                      <RefreshCw className="w-10 h-10 text-text-tertiary mx-auto mb-2" />
                      <p className="text-text-tertiary text-sm">No hay ciclos creados. Crea uno para agrupar prestamos, conversiones y lotes FCI.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cycleEngine.metrics.map(m => (
                        <div key={m.cycleId}>
                          <CycleCard
                            metrics={m}
                            isExpanded={expandedCycleId === m.cycleId}
                            onToggleExpand={handleToggleExpand}
                            onEdit={handleEditCycle}
                            onClose={handleCloseCycle}
                            onDelete={handleDeleteCycle}
                          />
                          {expandedCycleId === m.cycleId && (
                            <CycleDetailView
                              cycleId={m.cycleId}
                              metrics={m}
                              portfolioId={currentPortfolio?.id}
                              onRefresh={loadCycles}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <MobileNav portfolioType={currentPortfolio?.portfolio_type} />

      <Suspense fallback={null}>
        <ConversionModal
          isOpen={convModalOpen}
          onClose={() => setConvModalOpen(false)}
          onSave={handleSaveConversion}
          loans={loans}
          activeCycles={cycles.filter(c => c.status === 'active')}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CycleModal
          isOpen={cycleModalOpen}
          onClose={() => { setCycleModalOpen(false); setEditingCycle(null); }}
          onSave={handleSaveCycle}
          cycle={editingCycle}
          loans={loans}
        />
      </Suspense>
    </div>
  );
}
