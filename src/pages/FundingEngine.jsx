import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import { useCauciones } from '@/features/financing/hooks/useCauciones';
import { useCarryMetrics } from '@/hooks/useCarryMetrics';
import { formatARS, formatPercent, formatNumber } from '@/utils/formatters';

// ===========================================================================
// CONFIGURACIÓN TNA FCI - Ajustar según el fondo utilizado
// ===========================================================================
const TNA_FCI_DEFAULT = 0.32; // 32% TNA para fondos money market (Balanz Capital, por ejemplo)

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
const StatusBadge = ({ status, label }) => {
  const styles = {
    sobrecapitalizado: 'bg-success/10 text-success border-success/30',
    optimo: 'bg-success/10 text-success border-success/30',
    ajustado: 'bg-warning/10 text-warning border-warning/30',
    deficit: 'bg-danger/10 text-danger border-danger/30',
    amplio: 'bg-success/10 text-success border-success/30',
    medio: 'bg-primary/10 text-primary border-primary/30',
    estrecho: 'bg-warning/10 text-warning border-warning/30',
    critico: 'bg-danger/10 text-danger border-danger/30',
  };

  const icons = {
    sobrecapitalizado: CheckCircle,
    optimo: CheckCircle,
    ajustado: AlertTriangle,
    deficit: AlertTriangle,
    amplio: Shield,
    medio: Shield,
    estrecho: AlertTriangle,
    critico: AlertTriangle,
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
  const { currentPortfolio, fciTotals } = usePortfolio();
  const { lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Cargar cauciones
  const { cauciones, loading: caucionesLoading, error: caucionesError, refresh: refreshCauciones } = useCauciones(
    user?.id,
    currentPortfolio?.id
  );

  // Crear objeto fciEngine compatible con useCarryMetrics
  const fciEngine = {
    totals: fciTotals || { valuation: 0 },
  };

  // Calcular métricas de carry
  const carryMetrics = useCarryMetrics({
    cauciones,
    fciEngine,
    tnaFCI: TNA_FCI_DEFAULT,
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

  // Estado de cobertura para colores
  const getCoverageStatus = (ratio) => {
    if (ratio >= 115) return 'success';
    if (ratio >= 100) return 'success';
    if (ratio >= 90) return 'warning';
    return 'danger';
  };

  const getBufferStatus = (bufferPct) => {
    if (bufferPct > 8) return 'success';
    if (bufferPct > 4) return 'info';
    if (bufferPct > 2) return 'warning';
    return 'danger';
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
              {/* KPIs Principales */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Caución"
                  value={formatARS(carryMetrics.totalCaucion)}
                  subtitle={`${carryMetrics.caucionesVigentes} vigentes`}
                  icon={DollarSign}
                  status="info"
                />
                <MetricCard
                  title="Saldo FCI"
                  value={formatARS(carryMetrics.saldoFCI)}
                  subtitle={`TNA ${formatPercent(carryMetrics.tnaFCI * 100)}`}
                  icon={BarChart3}
                  status="info"
                />
                <MetricCard
                  title="Ratio Cobertura"
                  value={formatPercent(carryMetrics.ratioCobertura - 100).replace('+', '') + ' cob.'}
                  subtitle={<StatusBadge status={carryMetrics.estadoCobertura} />}
                  icon={Shield}
                  status={getCoverageStatus(carryMetrics.ratioCobertura)}
                  trend={carryMetrics.ratioCobertura - 100}
                />
                <MetricCard
                  title="Buffer Tasa"
                  value={formatPercent(carryMetrics.bufferTasaPct)}
                  subtitle={<StatusBadge status={carryMetrics.estadoBuffer} />}
                  icon={Zap}
                  status={getBufferStatus(carryMetrics.bufferTasaPct)}
                  trend={carryMetrics.bufferTasaPct}
                />
              </div>

              {/* Cobertura y Targets */}
              <Section title="Cobertura de Capital" icon={Target}>
                <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Barra de Cobertura */}
                    <div className="space-y-4">
                      <ProgressBar
                        value={carryMetrics.saldoFCI}
                        max={carryMetrics.fciOptimo}
                        label="Cobertura vs Óptimo"
                        color={carryMetrics.ratioCobertura >= 100 ? 'success' : carryMetrics.ratioCobertura >= 90 ? 'warning' : 'danger'}
                      />

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-text-tertiary">FCI Mínimo (1:1)</p>
                          <p className="font-mono font-semibold text-text-primary">{formatARS(carryMetrics.fciMinimo)}</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary">FCI Óptimo (+15%)</p>
                          <p className="font-mono font-semibold text-text-primary">{formatARS(carryMetrics.fciOptimo)}</p>
                        </div>
                      </div>

                      {carryMetrics.deficitMinimo > 0 && (
                        <div className="p-3 bg-danger/5 border border-danger/20 rounded-lg">
                          <p className="text-danger text-sm font-medium">
                            <AlertTriangle className="inline w-4 h-4 mr-1" />
                            Déficit: {formatARS(carryMetrics.deficitMinimo)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Capital Productivo */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-text-secondary">Utilización de Capital</h4>

                      <div className="flex gap-2">
                        <div className="flex-1 p-3 bg-success/5 border border-success/20 rounded-lg">
                          <p className="text-success text-xs uppercase tracking-wider">Productivo</p>
                          <p className="font-mono font-bold text-lg text-success">{formatARS(carryMetrics.capitalProductivo)}</p>
                          <p className="text-success/70 text-xs">{formatNumber(carryMetrics.pctProductivo, 1)}%</p>
                        </div>
                        <div className="flex-1 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                          <p className="text-danger text-xs uppercase tracking-wider">Improductivo</p>
                          <p className="font-mono font-bold text-lg text-danger">{formatARS(carryMetrics.capitalImproductivo)}</p>
                          <p className="text-danger/70 text-xs">{formatNumber(carryMetrics.pctImproductivo, 1)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Performance */}
              <Section title="Performance de Carry" icon={Activity}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Spread Diario */}
                  <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                    <h4 className="text-sm font-medium text-text-tertiary mb-3">Spread Neto Diario</h4>
                    <p className={`text-3xl font-bold font-mono ${carryMetrics.spreadNetoDia >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(carryMetrics.spreadNetoDia)}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      ROE Anualizado: <span className="font-mono text-primary">{formatPercent(carryMetrics.roeCaucion)}</span>
                    </p>
                  </div>

                  {/* Carry Perdido */}
                  <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                    <h4 className="text-sm font-medium text-text-tertiary mb-3">Carry Perdido</h4>
                    <p className="text-3xl font-bold font-mono text-danger">
                      {formatARS(carryMetrics.carryPerdidoDia)}<span className="text-sm text-text-tertiary">/día</span>
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Anual: <span className="font-mono text-danger">{formatARS(carryMetrics.carryPerdidoAnual)}</span>
                    </p>
                  </div>

                  {/* Spread Acumulado */}
                  <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
                    <h4 className="text-sm font-medium text-text-tertiary mb-3">Spread Acumulado</h4>
                    <p className={`text-3xl font-bold font-mono ${carryMetrics.spreadAcumulado >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatARS(carryMetrics.spreadAcumulado)}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Oportunidad perdida: <span className="font-mono text-warning">{formatARS(carryMetrics.oportunidadPerdida)}</span>
                    </p>
                  </div>
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
                  TNA FCI configurada: {formatPercent(TNA_FCI_DEFAULT * 100)}
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
