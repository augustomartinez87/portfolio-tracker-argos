import React, { useState, useMemo, useEffect } from 'react';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePrices, invokeFetchPrices } from '@/features/portfolio/services/priceService';
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
import { DashboardTab } from '@/components/funding/DashboardTab';
import { AnalysisTab } from '@/components/funding/AnalysisTab';
import { OperationsTab } from '@/components/funding/OperationsTab';
import { fciService } from '@/features/fci/services/fciService';

// ===========================================================================
// COMPONENTE PRINCIPAL
// ===========================================================================

export default function FundingEngine() {
  const { user, signOut } = useAuth();
  const { currentPortfolio, fciLotEngine } = usePortfolio();
  const { isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarPinned') === 'true';
  });
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarPinned') === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarPinned', sidebarPinned ? 'true' : 'false');
    }
  }, [sidebarPinned]);


  // Estado para tabs
  const [activeTab, setActiveTab] = useState('dashboard');
  const [caucionCutoffMode, setCaucionCutoffMode] = useState('auto');

  // Obtener el fciId del FCI con mayor valuación (el principal)
  const fciPositions = fciLotEngine?.positions || [];
  const fciLots = useMemo(() => {
    // Obtener todos los lotes activos de todas las posiciones
    const allLots = [];
    fciPositions.forEach(pos => {
      if (pos.lots && Array.isArray(pos.lots)) {
        pos.lots.forEach(lot => {
          allLots.push({
            ...lot,
            fciId: pos.fciId,
            fciName: pos.name,
          });
        });
      }
    });
    return allLots;
  }, [fciPositions]);
  
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

  // TNA FCI derivada de datos del motor por lotes (sin usar precios directos)
  const totalPnlDiario = useMemo(() => (
    fciPositions.reduce((sum, pos) => sum + (pos.pnlDiario || 0), 0)
  ), [fciPositions]);
  const fciValuationTotal = fciLotEngine?.totals?.valuation || 0;
  const fciTotalPnl = fciLotEngine?.totals?.pnl || 0;
  const tnaFCIDynamic = fciValuationTotal > 0
    ? (totalPnlDiario / fciValuationTotal) * 365
    : 0;
  const isFallback = fciValuationTotal <= 0;
  const ultimaPreciofecha = useMemo(() => {
    const mainPos = fciPositions.find(p => p.fciId === mainFciId);
    return mainPos?.priceDate || null;
  }, [fciPositions, mainFciId]);
  const fciDailyPnlPct = fciValuationTotal > 0
    ? totalPnlDiario / fciValuationTotal
    : 0;

  // Verificar si hay precio de hoy (para no mostrar PnL diario si no hay)
  const todayStr = new Date().toISOString().split('T')[0];
  const hasTodayPrice = useMemo(() => {
    if (!mainFciId) return false;
    const mainPos = fciPositions.find(p => p.fciId === mainFciId);
    if (!mainPos?.priceDate) return false;
    return mainPos.priceDate === todayStr;
  }, [fciPositions, mainFciId, todayStr]);

  // Cargar cauciones
  const { cauciones, loading: caucionesLoading, error: caucionesError, refresh: refreshCauciones } = useCauciones(
    user?.id,
    currentPortfolio?.id
  );

  // Cargar precios históricos de VCP (formato: {fciId: {fecha: vcp}})
  const [vcpPricesMap, setVcpPricesMap] = useState({});

  // Convertir vcpPricesMap al formato array para useCarryMetrics
  // Usar el FCI principal (con mayor valuación)
  const vcpHistoricos = useMemo(() => {
    if (!mainFciId || !vcpPricesMap[mainFciId]) return [];

    const vcpMap = vcpPricesMap[mainFciId];
    return Object.entries(vcpMap).map(([fecha, vcp]) => ({
      fecha,
      vcp: Number(vcp)
    })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [mainFciId, vcpPricesMap]);

  useEffect(() => {
    const loadVcpHistory = async () => {
      if (!fciPositions || fciPositions.length === 0 || !cauciones || cauciones.length === 0) return;

      try {
        // Encontrar fecha mínima de cauciones
        const minDate = cauciones.reduce((min, c) => {
          const fecha = c.fecha_inicio?.split('T')[0];
          return fecha && (!min || fecha < min) ? fecha : min;
        }, null);

        if (!minDate) return;

        // Cargar precios históricos para cada FCI desde la fecha más antigua
        const pricesMap = {};
        await Promise.all(fciPositions.map(async (pos) => {
          const prices = await fciService.getPrices(pos.fciId, minDate);
          if (prices && prices.length > 0) {
            // Crear un mapa de fecha -> vcp para lookup rápido
            pricesMap[pos.fciId] = prices.reduce((map, p) => {
              map[p.fecha] = p.vcp;
              return map;
            }, {});
          }
        }));

        setVcpPricesMap(pricesMap);
      } catch (err) {
        console.error('[FundingEngine] Error loading VCP history:', err);
      }
    };

    loadVcpHistory();
  }, [fciPositions, cauciones]);


  // Crear objeto fciEngine compatible con useCarryMetrics
  const fciEngine = {
    totals: fciLotEngine?.totals || { valuation: 0 },
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
  const historicalStats = null;

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
                  isPinned={sidebarPinned}
                  setIsPinned={setSidebarPinned}
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
                  fciLots={fciLots}
                  fciValuation={fciLotEngine?.totals?.valuation || 0}
                  fciTotalPnl={fciTotalPnl}
                  fciDailyPnl={hasTodayPrice ? totalPnlDiario : 0}
                  fciDailyPnlPct={hasTodayPrice ? fciDailyPnlPct : 0}
                  hasTodayPrice={hasTodayPrice}
                  vcpHistoricos={vcpPricesMap}
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


