import React, { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePrices, invokeFetchPrices } from '@/features/portfolio/services/priceService';
import { fciService } from '@/features/fci/services/fciService';
import {
  Database,
  LayoutDashboard,
  BarChart2,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import { useCauciones } from '@/features/financing/hooks/useCauciones';
import { useCarryMetrics } from '@/hooks/useCarryMetrics';
import { useFciTNA } from '@/hooks/useFciTNA';
import { useHistoricalRates } from '@/hooks/useHistoricalRates';
import { DashboardTab } from '@/components/funding/DashboardTab';
import { AnalysisTab } from '@/components/funding/AnalysisTab';
import { OperationsTab } from '@/components/funding/OperationsTab';
import { formatARS, formatPercent, formatNumber } from '@/utils/formatters';

// ===========================================================================
// COMPONENTE PRINCIPAL
// ===========================================================================

export default function FundingEngine() {
  const { user, signOut } = useAuth();
  const { currentPortfolio, fciTotals, fciPositions } = usePortfolio();
  const { lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Estado para tabs
  const [activeTab, setActiveTab] = useState('dashboard');
  const [caucionCutoffMode, setCaucionCutoffMode] = useState('auto');

  // Obtener el fciId del FCI con mayor valuación (el principal)
  const mainFciId = useMemo(() => {
    if (!fciPositions || fciPositions.length === 0) return null;

    // Si solo hay un FCI, usar ese
    if (fciPositions.length === 1) return fciPositions[0].fciId;

    // Si hay múltiples, usar el de mayor valuación
    const mainFci = fciPositions.reduce((max, current) =>
      (current.valuation > max.valuation) ? current : max
    );
    return mainFci.fciId;
  }, [fciPositions]);

  // Calcular TNA dinámica del FCI principal
  const { tnaFCI: tnaFCIDynamic, loading: tnaLoading, error: tnaError, isFallback, ultimaPreciofecha, vcpPrices: vcpRecientes } = useFciTNA(mainFciId);

  // Cargar cauciones
  const { cauciones, loading: caucionesLoading, error: caucionesError, refresh: refreshCauciones } = useCauciones(
    user?.id,
    currentPortfolio?.id
  );

  // Fetch de VCP históricos para cubrir todas las fechas de las cauciones
  const [vcpHistoricos, setVcpHistoricos] = useState([]);
  useEffect(() => {
    if (!mainFciId || !cauciones || cauciones.length === 0) {
      setVcpHistoricos([]);
      return;
    }

    // Encontrar la fecha más antigua entre todas las cauciones
    const fechaMasAntigua = cauciones.reduce((min, c) => {
      const fecha = String(c.fecha_inicio).split('T')[0];
      return !min || fecha < min ? fecha : min;
    }, null);

    if (!fechaMasAntigua) {
      setVcpHistoricos([]);
      return;
    }

    fciService.getPrices(mainFciId, fechaMasAntigua)
      .then(data => setVcpHistoricos(data || []))
      .catch(err => console.error('[FundingEngine] Error fetching historical VCP:', err));
  }, [mainFciId, cauciones]);

  // Crear objeto fciEngine compatible con useCarryMetrics
  const fciEngine = {
    totals: fciTotals || { valuation: 0 },
  };

  // Calcular métricas de carry con TNA dinámica
  const carryMetrics = useCarryMetrics({
    cauciones,
    fciEngine,
    tnaFCI: tnaFCIDynamic,
    caucionCutoffMode,
    vcpPrices: vcpHistoricos,
  });

  // Cargar datos históricos para benchmark (30 días)
  const { stats: historicalStats } = useHistoricalRates(
    mainFciId,
    currentPortfolio?.id,
    user?.id,
    30
  );

  const handleManualRefresh = async () => {
    try {
      await invokeFetchPrices();
      refetchPrices();
      refreshCauciones();
    } catch (error) {
      console.error('Manual refresh failed', error);
    }
  };

  const isLoading = isPricesLoading || isPricesFetching || caucionesLoading;

  return (
    <div className="min-h-screen bg-background-primary flex">
      <DashboardSidebar
        user={user}
        signOut={signOut}
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
      />

      <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 flex flex-col mb-16 lg:mb-0 min-h-screen ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
        <div className="p-4 lg:p-6 flex flex-col flex-1">
          <PageHeader
            title="Funding Engine"
            subtitle="Carry Trade & Liquidez"
            icon={Database}
            loading={isLoading}
            onRefresh={handleManualRefresh}
            showCurrencySelector={false}
          />

          {!currentPortfolio ? (
            <PortfolioEmptyState
              title="Sin Portfolio"
              message="Selecciona o crea un portfolio para ver tus métricas de funding."
            />
          ) : caucionesError ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-danger/5 border border-danger/20 rounded-xl">
                <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">Error cargando datos</h3>
                <p className="text-text-secondary text-sm">{caucionesError}</p>
                <button
                  onClick={refreshCauciones}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          ) : !carryMetrics ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-background-secondary border border-border-primary rounded-xl">
                <Database className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">Sin datos de Carry</h3>
                <p className="text-text-secondary text-sm">
                  Cargá cauciones desde la sección de Financiación para ver las métricas de carry trade.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Tabs de navegación */}
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
                    onClick={() => setActiveTab('analysis')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'analysis'
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" />
                      Análisis
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('operations')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'operations'
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Operaciones
                    </span>
                  </button>
                </div>
              </div>

              {/* Contenido según tab activo */}
              {activeTab === 'dashboard' && (
                <DashboardTab
                  carryMetrics={carryMetrics}
                  isFallback={isFallback}
                  caucionCutoffMode={caucionCutoffMode}
                  onCaucionCutoffModeChange={setCaucionCutoffMode}
                  historicalStats={historicalStats}
                  ultimaPreciofecha={ultimaPreciofecha}
                />
              )}

              {activeTab === 'analysis' && (
                <AnalysisTab
                  carryMetrics={carryMetrics}
                  fciId={mainFciId}
                  portfolioId={currentPortfolio?.id}
                  userId={user?.id}
                />
              )}

              {activeTab === 'operations' && (
                <OperationsTab
                  cauciones={cauciones}
                  vcpPrices={vcpHistoricos}
                  tnaMA7={tnaFCIDynamic}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
