import React from 'react';
import { Link } from 'react-router-dom';
import {
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
  Clock,
} from 'lucide-react';
import { AlertsPanel } from './AlertsPanel';
import { ScenarioSimulator } from './ScenarioSimulator';
import { CompoundProjection } from './CompoundProjection';
import { MetricCard } from '@/components/common/MetricCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Section } from '@/components/common/Section';
import { formatARS, formatPercent, formatNumber, formatDateTime } from '@/utils/formatters';

// Helper para formatear fecha
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Barra de progreso con marcadores (para cobertura de capital)
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
        
        {/* Leyenda debajo de la barra - responsive */}
        <div className="flex flex-wrap justify-between text-[10px] text-text-tertiary mt-4 gap-x-4 gap-y-1">
          <span>0%</span>
          <span className="text-center">100% (Meta 1:1)</span>
          <span className="text-right">115% (Meta Óptima)</span>
        </div>
      </div>
    </div>
  );
};

export function DashboardTab({
  carryMetrics,
  isFallback,
  caucionCutoffMode,
  onCaucionCutoffModeChange,
  historicalStats,
}) {
  // Funciones de estado para semáforos
  const getCoverageStatus = (ratio) => {
    if (ratio >= 100) return 'success';
    if (ratio >= 90) return 'warning';
    return 'danger';
  };

  const getCoverageLabel = (ratio) => {
    if (ratio >= 100) return 'Óptimo';
    if (ratio >= 90) return 'Casi cubierto';
    return 'Déficit';
  };

  const getSpreadStatus = (spreadPct) => {
    if (spreadPct >= 2.0) return 'success';
    if (spreadPct >= 1.0) return 'success-light';
    if (spreadPct >= 0.5) return 'warning';
    if (spreadPct > 0) return 'danger';
    return 'danger';
  };

  const getSpreadLabel = (spreadPct) => {
    if (spreadPct >= 2.0) return 'Óptimo';
    if (spreadPct >= 1.0) return 'Saludable';
    if (spreadPct >= 0.5) return 'Ajustado';
    if (spreadPct > 0) return 'Crítico';
    return 'Negativo';
  };

  const cutoffOptions = [
    { id: 'auto', label: 'Auto', hint: 'Recomendado' },
    { id: 'today', label: 'Hoy', hint: 'Corte al d?a' },
    { id: 'last', label: '?ltimo venc.', hint: '?ltima fecha' },
    { id: 'all', label: 'Hist?rico', hint: 'Todas' },
  ];

  const cutoffDateLabel = carryMetrics.metadata?.cutoffFecha
    ? formatDate(carryMetrics.metadata.cutoffFecha)
    : '';

  const showCutoffLabel = Boolean(cutoffDateLabel) && caucionCutoffMode !== 'today';



  return (
    <div className="space-y-6">
      {/* Warning de TNA Fallback */}
      {isFallback && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">
            <span className="font-medium">TNA estimada:</span> No hay suficientes datos históricos del FCI. Se está usando una TNA de referencia del 32%. Cargá precios históricos en la sección FCI para obtener una TNA calculada.
          </p>
        </div>
      )}

      {/* Warning de Cauciones Vencidas */}
      {carryMetrics.metadata?.todasVencidas && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">
            <span className="font-medium">Sin cauciones vigentes.</span>
            {' '}Última caución venció el {formatDate(carryMetrics.metadata.ultimaCaucionFecha)}.
            {' '}
            <Link to="/financiacion" className="underline hover:text-warning/80">
              Cargar nuevas cauciones
            </Link>
          </p>
        </div>
      )}

      {/* Toggle de corte para cauciones */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-tertiary uppercase tracking-wider">Corte cauciones</span>
        <div className="inline-flex items-center bg-background-secondary border border-border-primary rounded-lg p-1">
          {cutoffOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onCaucionCutoffModeChange?.(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                caucionCutoffMode === opt.id
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
              }`}
              title={opt.hint}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
        {cutoffDateLabel && caucionCutoffMode !== 'today' && (
          <span className="text-xs text-text-tertiary">
            Corte: {cutoffDateLabel}
          </span>
        )}
      </div>

      {/* Hero Card - Spread Principal */}
      <div className={`rounded-xl p-6 border-2 ${
        carryMetrics.bufferTasaPct >= 2
          ? 'bg-gradient-to-r from-success/10 to-primary/5 border-success/30'
          : carryMetrics.bufferTasaPct >= 0.5
            ? 'bg-gradient-to-r from-warning/10 to-primary/5 border-warning/30'
            : 'bg-gradient-to-r from-danger/10 to-primary/5 border-danger/30'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-text-tertiary text-sm uppercase tracking-wider mb-1">Spread Actual</p>
            <p className={`text-4xl font-bold font-mono ${
              carryMetrics.bufferTasaPct >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {formatPercent(carryMetrics.bufferTasaPct)}
            </p>
            {/* Timestamp y benchmark */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px]">
              <span className="text-text-tertiary">
                {formatDateTime(carryMetrics.ultimaActualizacion, 'full')}
              </span>
              {historicalStats && (
                <>
                  <span className={`font-medium ${
                    carryMetrics.bufferTasaPct > historicalStats.spreadPromedio
                      ? 'text-success'
                      : 'text-warning'
                  }`}>
                    {carryMetrics.bufferTasaPct > historicalStats.spreadPromedio ? '↑' : '↓'}{' '}
                    {formatNumber(Math.abs(carryMetrics.bufferTasaPct - historicalStats.spreadPromedio), 2)}pp vs 30d
                  </span>
                  <span className="text-primary font-medium">
                    Top {100 - historicalStats.percentilActual}%
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge
              status={getSpreadStatus(carryMetrics.bufferTasaPct)}
              label={getSpreadLabel(carryMetrics.bufferTasaPct)}
              tooltip=">=2%: Óptimo | >=1%: Saludable | >=0.5%: Ajustado | >0%: Crítico | <=0%: Negativo"
            />
            {/* CTA contextual */}
            {carryMetrics.estadoCobertura === 'deficit' && (
              <Link
                to="/financiacion"
                className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                <Target className="w-3 h-3" />
                Suscribir {formatARS(carryMetrics.deficitMinimo)}
              </Link>
            )}
            {carryMetrics.estadoCobertura === 'sobrecapitalizado' && (
              <div className="px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded-lg flex items-center gap-1 border border-success/30">
                <CheckCircle className="w-3 h-3" />
                Excedente disponible
              </div>
            )}
            <div className={`p-3 rounded-lg ${
              carryMetrics.bufferTasaPct >= 0 ? 'bg-success/10' : 'bg-danger/10'
            }`}>
              <Zap className={`w-6 h-6 ${
                carryMetrics.bufferTasaPct >= 0 ? 'text-success' : 'text-danger'
              }`} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 pt-4 border-t border-border-secondary">
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wider">Diario</p>
            <p className={`font-mono font-semibold text-lg ${
              carryMetrics.spreadNetoDia >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {formatARS(carryMetrics.spreadNetoDia)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wider">Mensual</p>
            <p className={`font-mono font-semibold text-lg ${
              carryMetrics.spreadMensualProyectado >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {formatARS(carryMetrics.spreadMensualProyectado)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wider">Anual</p>
            <p className={`font-mono font-semibold text-lg ${
              carryMetrics.spreadAnualProyectado >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {formatARS(carryMetrics.spreadAnualProyectado)}
            </p>
          </div>
          <div className="ml-auto">
            <p className="text-xs text-text-secondary uppercase tracking-wider font-medium">Acumulado</p>
            <p className={`font-mono font-semibold text-lg ${
              carryMetrics.spreadAcumulado >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {formatARS(carryMetrics.spreadAcumulado)}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs Secundarios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Total Caución - Con mensaje de cauciones vencidas */}
        <MetricCard
          title="Total Caución"
          value={formatARS(carryMetrics.totalCaucion)}
          subtitle={
            showCutoffLabel ? (
              <span className="flex items-center gap-1 text-text-tertiary">
                Corte: {cutoffDateLabel}
              </span>
            ) : carryMetrics.metadata?.todasVencidas ? (
              <span className="flex items-center gap-1 text-warning">
                <Clock className="w-3 h-3" />
                ?ltima: {formatDate(carryMetrics.metadata.ultimaCaucionFecha)}
              </span>
            ) : (
              `${carryMetrics.caucionesVigentes} vigentes`
            )
          }
          icon={DollarSign}
          status={carryMetrics.metadata?.todasVencidas ? 'warning' : 'info'}
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

        {/* KPI 3: % Cobertura - Mostrar porcentaje positivo con nuevo semáforo */}
        <MetricCard
          title="% Cobertura"
          value={`${formatNumber(carryMetrics.ratioCobertura, 1)}%`}
          subtitle={<StatusBadge status={getCoverageStatus(carryMetrics.ratioCobertura)} label={getCoverageLabel(carryMetrics.ratioCobertura)} />}
          icon={Shield}
          status={getCoverageStatus(carryMetrics.ratioCobertura)}
        />
      </div>

      {/* Alertas y Acciones */}
      <AlertsPanel carryMetrics={carryMetrics} isFallback={isFallback} />

      {/* Cobertura de Capital */}
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

      {/* Performance de Carry - Costo de Oportunidad */}
      <Section title="Performance de Carry" icon={Activity}>
        {/* ROE Card */}
        <div className="bg-background-secondary rounded-xl p-4 border border-border-primary mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">ROE Caución (Anualizado)</p>
              <p className="text-2xl font-bold font-mono text-primary">
                {formatPercent(carryMetrics.roeCaucion)}
              </p>
            </div>
            <p className="text-xs text-text-secondary">
              Retorno sobre capital caucionado
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            saldoFCI={carryMetrics.saldoFCI}
            costoCaucionDia={carryMetrics.costoCaucionDia}
            totalCaucion={carryMetrics.totalCaucion}
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

      {/* Análisis de Tasas */}
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
        </p>
      </div>
    </div>
  );
}

export default DashboardTab;
