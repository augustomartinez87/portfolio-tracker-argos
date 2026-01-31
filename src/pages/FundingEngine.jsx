import React, { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePrices, invokeFetchPrices } from '@/features/portfolio/services/priceService';
import {
  Database,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Percent,
  Activity,
  BarChart3,
  Target,
  Zap,
  Sliders,
  Sparkles,
} from 'lucide-react';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import { useCauciones } from '@/features/financing/hooks/useCauciones';
import { useCarryMetrics } from '@/hooks/useCarryMetrics';
import { useFciTNA } from '@/hooks/useFciTNA';
import { AlertsPanel } from '@/components/funding/AlertsPanel';
import { ScenarioSimulator } from '@/components/funding/ScenarioSimulator';
import { CompoundProjection } from '@/components/funding/CompoundProjection';
import { formatARS, formatPercent, formatNumber } from '@/utils/formatters';

// ===========================================================================
// COMPONENTES DE UI
// ===========================================================================

/**
 * Tarjeta de métrica con estado visual
 */
const MetricCard = ({ title, value, subtitle, icon: Icon, status, trend }) => {
  const statusColors = {
    success: 'border-l-success bg-success/5',
    warning: 'border-l-warning bg-warning/5',
    danger: 'border-l-danger bg-danger/5',
    info: 'border-l-primary bg-primary/5',
    neutral: 'border-l-border-secondary bg-background-tertiary',
  };

  const trendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : null;
  const trendColor = trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-tertiary';

  return (
    <div className={`bg-background-secondary rounded-lg p-4 border border-border-primary border-l-4 ${statusColors[status] || statusColors.neutral}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold font-mono text-text-primary">{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 ${trendColor}`}>
              {trendIcon && React.createElement(trendIcon, { className: 'inline w-3 h-3 mr-1' })}
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${status === 'success' ? 'bg-success/10 text-success' : status === 'danger' ? 'bg-danger/10 text-danger' : status === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Badge de estado
 */
const StatusBadge = ({ status, label, variant = 'default' }) => {
  const styles = {
    // Estados de cobertura
    sobrecapitalizado: 'bg-success/10 text-success border-success/30',
    optimo: 'bg-success/10 text-success border-success/30',
    ajustado: 'bg-warning/10 text-warning border-warning/30',
    deficit: 'bg-danger/10 text-danger border-danger/30',
    // Estados de spread
    'optimo-spread': 'bg-success/10 text-success border-success/30',
    'saludable-spread': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'ajustado-spread': 'bg-warning/10 text-warning border-warning/30',
    'critico-spread': 'bg-orange-100 text-orange-700 border-orange-300',
    'negativo-spread': 'bg-danger/10 text-danger border-danger/30',
    // Estados legacy
    amplio: 'bg-success/10 text-success border-success/30',
    medio: 'bg-primary/10 text-primary border-primary/30',
    estrecho: 'bg-warning/10 text-warning border-warning/30',
    critico: 'bg-danger/10 text-danger border-danger/30',
    success: 'bg-success/10 text-success border-success/30',
    'success-light': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
  };

  const icons = {
    sobrecapitalizado: CheckCircle,
    optimo: CheckCircle,
    ajustado: AlertTriangle,
    deficit: AlertTriangle,
    'optimo-spread': CheckCircle,
    'saludable-spread': CheckCircle,
    'ajustado-spread': AlertTriangle,
    'critico-spread': AlertTriangle,
    'negativo-spread': AlertTriangle,
    amplio: Shield,
    medio: Shield,
    estrecho: AlertTriangle,
    critico: AlertTriangle,
    success: CheckCircle,
    'success-light': CheckCircle,
    warning: AlertTriangle,
    danger: AlertTriangle,
  };

  const Icon = icons[status] || Shield;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-background-tertiary text-text-secondary border-border-primary'}`}>
      <Icon className="w-3 h-3" />
      {label || status}
    </span>
  );
};

/**
 * Barra de progreso visual
 */
const ProgressBar = ({ value, max, label, color = 'primary' }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colors = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-text-tertiary">{label}</span>
          <span className="text-text-secondary font-mono">{formatPercent(percentage - 100).replace('+', '')}</span>
        </div>
      )}
      <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Barra de progreso con marcadores (para cobertura de capital)
 * Muestra progreso hacia 100% con marcadores en 100% y 115%
 */
const ProgressBarWithMarkers = ({ current, target100, target115, color = 'primary' }) => {
  const colors = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  const percentage = target100 > 0 ? Math.min((current / target100) * 100, 130) : 0;
  const coverageRatio = target100 > 0 ? (current / target100) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Cobertura actual */}
      <div className="flex justify-between text-sm">
        <span className="text-text-tertiary">Cobertura actual</span>
        <span className={`font-mono font-semibold ${coverageRatio >= 100 ? 'text-success' : coverageRatio >= 90 ? 'text-warning' : 'text-danger'}`}>
          {formatNumber(coverageRatio, 1)}%
        </span>
      </div>
      
      {/* Barra de progreso con marcadores */}
      <div className="relative">
        {/* Barra base */}
        <div className="h-3 bg-background-tertiary rounded-full overflow-hidden relative">
          {/* Progreso */}
          <div
            className={`h-full ${colors[color]} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
          
          {/* Marcador 100% (Meta 1:1) */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-text-primary"
            style={{ left: '100%' }}
          >
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] text-text-primary whitespace-nowrap">
              100%
            </div>
          </div>
          
          {/* Marcador 115% (Meta Óptima) */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-success"
            style={{ left: '115%' }}
          >
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] text-success whitespace-nowrap">
              115%
            </div>
          </div>
        </div>
        
        {/* Leyenda debajo de la barra */}
        <div className="flex justify-between text-[10px] text-text-tertiary mt-4">
          <span>0%</span>
          <span className="ml-[90%]">100% (Meta 1:1)</span>
          <span className="ml-[5%]">115% (Meta Óptima)</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Sección con título
 */
const Section = ({ title, icon: Icon, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      {Icon && <Icon className="w-5 h-5 text-primary" />}
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
    </div>
    {children}
  </div>
);

// ===========================================================================
// COMPONENTE PRINCIPAL
// ===========================================================================

export default function FundingEngine() {
  const { user, signOut } = useAuth();
  const { currentPortfolio, fciTotals, fciPositions } = usePortfolio();
  const { lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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
  const { tnaFCI: tnaFCIDynamic, loading: tnaLoading, error: tnaError, isFallback } = useFciTNA(mainFciId);

  // Cargar cauciones
  const { cauciones, loading: caucionesLoading, error: caucionesError, refresh: refreshCauciones } = useCauciones(
    user?.id,
    currentPortfolio?.id
  );

  // Crear objeto fciEngine compatible con useCarryMetrics
  const fciEngine = {
    totals: fciTotals || { valuation: 0 },
  };

  // Calcular métricas de carry con TNA dinámica
  const carryMetrics = useCarryMetrics({
    cauciones,
    fciEngine,
    tnaFCI: tnaFCIDynamic,
  });

  // ===========================================================================
  // VALIDACIÓN - Console.log para verificar cálculos (remover en producción)
  // ===========================================================================
  useEffect(() => {
    if (carryMetrics) {
      console.log('=== MÉTRICAS DE CARRY CALCULADAS ===');
      console.log('FCI Mínimo:', carryMetrics.fciMinimo.toLocaleString('es-AR'), '(esperado: ~27M)');
      console.log('FCI Óptimo:', carryMetrics.fciOptimo.toLocaleString('es-AR'), '(esperado: ~31M)');
      console.log('Ratio Cobertura:', carryMetrics.ratioCobertura.toFixed(2) + '%', '(esperado: ~90%)');
      console.log('Estado Cobertura:', carryMetrics.estadoCobertura);
      console.log('---');
      console.log('Spread Neto Día:', carryMetrics.spreadNetoDia.toLocaleString('es-AR'), '(esperado: ~27k)');
      console.log('ROE Caución:', carryMetrics.roeCaucion.toFixed(2) + '%');
      console.log('Buffer Tasa:', (carryMetrics.bufferTasa * 100).toFixed(2) + '%', '(esperado: ~6.5%)');
      console.log('Estado Buffer:', carryMetrics.estadoBuffer);
      console.log('---');
      console.log('Capital Productivo:', carryMetrics.capitalProductivo.toLocaleString('es-AR'));
      console.log('Capital Improductivo:', carryMetrics.capitalImproductivo.toLocaleString('es-AR'));
      console.log('Carry Perdido/Día:', carryMetrics.carryPerdidoDia.toLocaleString('es-AR'));
      console.log('===================================');
    }
  }, [carryMetrics]);

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

  // ===========================================================================
  // FUNCIONES DE ESTADO PARA SEMÁFOROS
  // ===========================================================================
  
  // % Cobertura: Estado para colores del semáforo
  const getCoverageStatus = (ratio) => {
    if (ratio >= 100) return 'success';
    if (ratio >= 90) return 'warning';
    return 'danger';
  };

  // % Cobertura: Label según el rango
  const getCoverageLabel = (ratio) => {
    if (ratio >= 100) return 'Óptimo';
    if (ratio >= 90) return 'Casi cubierto';
    return 'Déficit';
  };

  // Spread: Estado para colores del semáforo
  const getSpreadStatus = (spreadPct) => {
    if (spreadPct >= 2.0) return 'success';
    if (spreadPct >= 1.0) return 'success-light';
    if (spreadPct >= 0.5) return 'warning';
    if (spreadPct > 0) return 'danger';
    return 'danger';
  };

  // Spread: Label según el rango
  const getSpreadLabel = (spreadPct) => {
    if (spreadPct >= 2.0) return 'Óptimo';
    if (spreadPct >= 1.0) return 'Saludable';
    if (spreadPct >= 0.5) return 'Ajustado';
    if (spreadPct > 0) return 'Crítico';
    return 'Negativo';
  };

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
              {/* Warning de TNA Fallback */}
              {isFallback && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
                  <p className="text-sm text-warning">
                    <span className="font-medium">TNA estimada:</span> No hay suficientes datos históricos del FCI. Se está usando una TNA de referencia del 32%. Cargá precios históricos en la sección FCI para obtener una TNA calculada.
                  </p>
                </div>
              )}
              
              {/* KPIs Principales */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Total Caución - Sin cambios */}
                <MetricCard
                  title="Total Caución"
                  value={formatARS(carryMetrics.totalCaucion)}
                  subtitle={`${carryMetrics.caucionesVigentes} vigentes`}
                  icon={DollarSign}
                  status="info"
                />
                
                {/* KPI 2: Saldo FCI - Con TNA dinámica y warning si es fallback */}
                <MetricCard
                  title="Saldo FCI"
                  value={formatARS(carryMetrics.saldoFCI)}
                  subtitle={
                    <span className="flex items-center gap-1">
                      TNA {formatPercent(carryMetrics.tnaFCI * 100)}
                      {isFallback && (
                        <span className="text-warning" title="Usando TNA estimada (sin datos históricos)">
                          <AlertTriangle className="inline w-3 h-3" />
                        </span>
                      )}
                    </span>
                  }
                  icon={BarChart3}
                  status={isFallback ? 'warning' : 'info'}
                />
                
                {/* KPI 3: % Cobertura (antes Ratio Cobertura) - Mostrar porcentaje positivo con nuevo semáforo */}
                <MetricCard
                  title="% Cobertura"
                  value={`${formatNumber(carryMetrics.ratioCobertura, 1)}%`}
                  subtitle={<StatusBadge status={getCoverageStatus(carryMetrics.ratioCobertura)} label={getCoverageLabel(carryMetrics.ratioCobertura)} />}
                  icon={Shield}
                  status={getCoverageStatus(carryMetrics.ratioCobertura)}
                />
                
                {/* KPI 4: Spread (antes Buffer Tasa) - Con semáforo de 5 niveles */}
                <MetricCard
                  title="Spread"
                  value={formatPercent(carryMetrics.bufferTasaPct)}
                  subtitle={<StatusBadge status={getSpreadStatus(carryMetrics.bufferTasaPct)} label={getSpreadLabel(carryMetrics.bufferTasaPct)} />}
                  icon={Zap}
                  status={getSpreadStatus(carryMetrics.bufferTasaPct).replace('-light', '')}
                  trend={carryMetrics.bufferTasaPct}
                />
              </div>

              {/* Alertas y Acciones */}
              <AlertsPanel carryMetrics={carryMetrics} isFallback={isFallback} />

              {/* Cobertura de Capital - Versión Mejorada */}
              <Section title="Cobertura de Capital" icon={Target}>
                <div className="bg-background-secondary rounded-xl p-4 border border-border-primary space-y-6">
                  {/* Barra de progreso con marcadores */}
                  <div className="space-y-4">
                    <ProgressBarWithMarkers
                      current={carryMetrics.saldoFCI}
                      target100={carryMetrics.fciMinimo}
                      target115={carryMetrics.fciOptimo}
                      color={carryMetrics.ratioCobertura >= 100 ? 'success' : carryMetrics.ratioCobertura >= 90 ? 'warning' : 'danger'}
                    />
                  </div>

                  {/* Cards de Metas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Meta 1:1 */}
                    <div className={`p-4 rounded-lg border ${
                      carryMetrics.ratioCobertura >= 100 
                        ? 'bg-success/5 border-success/30' 
                        : 'bg-background-tertiary border-border-secondary'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {carryMetrics.ratioCobertura >= 100 && <CheckCircle className="w-4 h-4 text-success" />}
                        <p className={`text-xs uppercase tracking-wider ${
                          carryMetrics.ratioCobertura >= 100 ? 'text-success' : 'text-text-tertiary'
                        }`}>
                          Meta 1:1
                        </p>
                      </div>
                      <p className="font-mono font-bold text-lg text-text-primary">{formatARS(carryMetrics.fciMinimo)}</p>
                      <p className={`text-sm mt-1 ${
                        carryMetrics.ratioCobertura >= 100 ? 'text-success' : 'text-warning'
                      }`}>
                        {carryMetrics.ratioCobertura >= 100 
                          ? '✅ Meta alcanzada' 
                          : `Faltan: ${formatARS(carryMetrics.deficitMinimo)}`
                        }
                      </p>
                    </div>

                    {/* Meta Óptima (+15%) */}
                    <div className={`p-4 rounded-lg border ${
                      carryMetrics.ratioCobertura >= 115 
                        ? 'bg-success/5 border-success/30' 
                        : 'bg-background-tertiary border-border-secondary'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {carryMetrics.ratioCobertura >= 115 && <CheckCircle className="w-4 h-4 text-success" />}
                        <p className={`text-xs uppercase tracking-wider ${
                          carryMetrics.ratioCobertura >= 115 ? 'text-success' : 'text-text-tertiary'
                        }`}>
                          Meta Óptima (+15%)
                        </p>
                      </div>
                      <p className="font-mono font-bold text-lg text-text-primary">{formatARS(carryMetrics.fciOptimo)}</p>
                      <p className={`text-sm mt-1 ${
                        carryMetrics.ratioCobertura >= 115 ? 'text-success' : 'text-primary'
                      }`}>
                        {carryMetrics.ratioCobertura >= 115 
                          ? '🎯 Meta óptima alcanzada' 
                          : `Faltan: ${formatARS(carryMetrics.deficitOptimo)}`
                        }
                      </p>
                    </div>
                  </div>

                  {/* Mensaje de estado según cobertura */}
                  {carryMetrics.ratioCobertura >= 115 && (
                    <div className="p-3 bg-success/10 border border-success/30 rounded-lg">
                      <p className="text-success text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Cobertura óptima alcanzada. Podés retirar ${formatARS(carryMetrics.saldoFCI - carryMetrics.fciOptimo)} para comprar más activos.
                      </p>
                    </div>
                  )}
                  {carryMetrics.ratioCobertura >= 100 && carryMetrics.ratioCobertura < 115 && (
                    <div className="p-3 bg-success/5 border border-success/30 rounded-lg">
                      <p className="text-success text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Meta 1:1 alcanzada. Faltan ${formatARS(carryMetrics.deficitOptimo)} para cobertura óptima.
                      </p>
                    </div>
                  )}

                  {/* Cards de Productivo e Improductivo con datos diarios */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-text-secondary">Utilización de Capital</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card Productivo */}
                      <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-success text-xs uppercase tracking-wider">Productivo</p>
                          <span className="text-success text-xs font-medium">{formatNumber(carryMetrics.pctProductivo, 1)}%</span>
                        </div>
                        <p className="font-mono font-bold text-xl text-success">{formatARS(carryMetrics.capitalProductivo)}</p>
                        <div className="mt-3 pt-3 border-t border-success/20">
                          <p className="text-xs text-text-secondary">
                            ✅ Generando: 
                            <span className="font-mono font-semibold text-success ml-1">
                              {formatARS(carryMetrics.gananciaProductivaDia)}/día
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Card Improductivo */}
                      <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-danger text-xs uppercase tracking-wider">Improductivo</p>
                          <span className="text-danger text-xs font-medium">{formatNumber(carryMetrics.pctImproductivo, 1)}%</span>
                        </div>
                        <p className="font-mono font-bold text-xl text-danger">{formatARS(carryMetrics.capitalImproductivo)}</p>
                        <div className="mt-3 pt-3 border-t border-danger/20">
                          <p className="text-xs text-text-secondary">
                            ❌ Perdiendo: 
                            <span className="font-mono font-semibold text-danger ml-1">
                              {formatARS(carryMetrics.carryPerdidoDia)}/día
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Performance de Carry - Versión Mejorada */}
              <Section title="Performance de Carry" icon={Activity}>
                {/* 4 Cards de Spread */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Card 1: Spread Diario */}
                  <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Spread Diario</h4>
                    <p className={`text-2xl font-bold font-mono ${carryMetrics.spreadNetoDia >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(carryMetrics.spreadNetoDia)}
                    </p>
                    <p className="text-xs text-text-tertiary mt-2">
                      TNA: <span className={`font-mono font-medium ${carryMetrics.bufferTasaPct >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatPercent(carryMetrics.bufferTasaPct)}
                      </span>
                    </p>
                  </div>

                  {/* Card 2: Spread Mensual (Proyectado) */}
                  <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Spread Mensual</h4>
                    <p className={`text-2xl font-bold font-mono ${carryMetrics.spreadMensualProyectado >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(carryMetrics.spreadMensualProyectado)}
                    </p>
                    <p className="text-xs text-text-tertiary mt-2">
                      (proyectado)
                    </p>
                  </div>

                  {/* Card 3: Spread Anual (Proyectado) */}
                  <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Spread Anual</h4>
                    <p className={`text-2xl font-bold font-mono ${carryMetrics.spreadAnualProyectado >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(carryMetrics.spreadAnualProyectado)}
                    </p>
                    <p className="text-xs text-text-tertiary mt-2">
                      ROE: <span className="font-mono font-medium text-primary">
                        {formatPercent(carryMetrics.roeCaucion)}
                      </span>
                    </p>
                  </div>

                  {/* Card 4: Spread Acumulado */}
                  <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Acumulado</h4>
                    <p className={`text-2xl font-bold font-mono ${carryMetrics.spreadAcumulado >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(carryMetrics.spreadAcumulado)}
                    </p>
                    <p className="text-xs text-text-tertiary mt-2">
                      Total histórico
                    </p>
                  </div>
                </div>

                {/* Subsección: Costo de Oportunidad */}
                <div className="bg-background-tertiary rounded-xl p-4 border border-border-secondary">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-danger" />
                    <h3 className="text-sm font-medium text-text-secondary">Costo de Oportunidad</h3>
                  </div>

                  {carryMetrics.ratioCobertura >= 115 ? (
                    <div className="p-3 bg-success/10 border border-success/30 rounded-lg">
                      <p className="text-success text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Sin costo de oportunidad - Meta óptima alcanzada
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Por capital improductivo */}
                      <div className="space-y-1">
                        <p className="text-xs text-text-tertiary">Por capital improductivo:</p>
                        <p className="text-lg font-mono font-semibold text-danger">
                          {formatARS(carryMetrics.carryPerdidoDia)}/día
                        </p>
                        <p className="text-xs text-text-secondary">
                          → {formatARS(carryMetrics.carryPerdidoAnual)}/año
                        </p>
                      </div>

                      {/* Por no alcanzar meta óptima */}
                      <div className="space-y-1">
                        <p className="text-xs text-text-tertiary">Por no alcanzar meta óptima:</p>
                        <p className="text-lg font-mono font-semibold text-warning">
                          {formatARS(carryMetrics.costoNoOptimoDia)}/día
                        </p>
                        <p className="text-xs text-text-secondary">
                          → {formatARS(carryMetrics.costoNoOptimoAnual)}/año
                        </p>
                      </div>

                      {/* Total histórico */}
                      <div className="space-y-1">
                        <p className="text-xs text-text-tertiary">Total oportunidad perdida histórica:</p>
                        <p className="text-lg font-mono font-semibold text-danger">
                          {formatARS(carryMetrics.oportunidadPerdida)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              {/* Simulador de Escenarios */}
              <Section title="Simulador de Escenarios" icon={Sliders}>
                <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                  <p className="text-sm text-text-secondary mb-4">
                    Ajustá las tasas para ver el impacto en tu carry trade
                  </p>
                  <ScenarioSimulator
                    tnaFCIActual={carryMetrics.tnaFCI}
                    tnaCaucionActual={carryMetrics.tnaCaucionPonderada}
                    capitalProductivo={carryMetrics.capitalProductivo}
                    spreadNetoDiaActual={carryMetrics.spreadNetoDia}
                    spreadMensualActual={carryMetrics.spreadMensualProyectado}
                    spreadAnualActual={carryMetrics.spreadAnualProyectado}
                    bufferTasaActual={carryMetrics.bufferTasaPct}
                  />
                </div>
              </Section>

              {/* Proyección de Interés Compuesto */}
              <Section title="Proyección de Interés Compuesto" icon={Sparkles}>
                <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                  <CompoundProjection
                    capitalProductivo={carryMetrics.capitalProductivo}
                    bufferTasa={carryMetrics.bufferTasa}
                  />
                </div>
              </Section>

              {/* Tasas */}
              <Section title="Análisis de Tasas" icon={Percent}>
                <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-background-tertiary rounded-lg">
                      <p className="text-text-tertiary text-xs uppercase tracking-wider">TNA FCI</p>
                      <p className="font-mono font-bold text-xl text-success">{formatPercent(carryMetrics.tnaFCI * 100)}</p>
                    </div>
                    <div className="text-center p-3 bg-background-tertiary rounded-lg">
                      <p className="text-text-tertiary text-xs uppercase tracking-wider">TNA Caución Pond.</p>
                      <p className="font-mono font-bold text-xl text-danger">{formatPercent(carryMetrics.tnaCaucionPonderada * 100)}</p>
                    </div>
                    <div className="text-center p-3 bg-background-tertiary rounded-lg">
                      <p className="text-text-tertiary text-xs uppercase tracking-wider">Buffer</p>
                      <p className={`font-mono font-bold text-xl ${carryMetrics.bufferTasa > 0 ? 'text-success' : 'text-danger'}`}>
                        {formatPercent(carryMetrics.bufferTasaPct)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-background-tertiary rounded-lg">
                      <p className="text-text-tertiary text-xs uppercase tracking-wider">Días Promedio</p>
                      <p className="font-mono font-bold text-xl text-primary">{formatNumber(carryMetrics.diasPromedio, 0)}</p>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Metadata */}
              <div className="text-center text-xs text-text-tertiary">
                <p>
                  {carryMetrics.totalOperaciones} operaciones analizadas
                  {' | '}
                  TNA FCI: {formatPercent(carryMetrics.tnaFCI * 100)}
                  {isFallback && (
                    <span className="text-warning ml-1">(estimada - sin datos históricos)</span>
                  )}
                  {tnaError && (
                    <span className="text-danger ml-1">(error al cargar TNA)</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
