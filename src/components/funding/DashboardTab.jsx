import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Target,
  Clock,
} from 'lucide-react';
import { AlertsPanel } from './AlertsPanel';
import { RatesEvolutionChart } from './RatesEvolutionChart';
import SummaryCard from '@/components/common/SummaryCard';
import { Section } from '@/components/common/Section';
import { formatARS, formatPercent, formatNumber, formatDateAR } from '@/utils/formatters';
import { useHistoricalRates } from '@/hooks/useHistoricalRates';

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
  ultimaPreciofecha,
  dataStartDate,
  fciId,
  portfolioId,
  userId,
}) {
  // Hook para obtener stats históricas de spread (30d) para alertas
  const { stats: spreadStats } = useHistoricalRates(fciId, portfolioId, userId, 30, dataStartDate);

  const getCoverageLabel = (ratio) => {
    if (ratio >= 100) return 'Óptimo';
    if (ratio >= 90) return 'Casi cubierto';
    return 'Déficit';
  };

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
            {' '}Última caución venció el {formatDateAR(carryMetrics.metadata.ultimaCaucionFecha)}.
            {' '}
            <Link to="/financiacion" className="underline hover:text-warning/80">
              Cargar nuevas cauciones
            </Link>
          </p>
        </div>
      )}

      {/* Warning de Spreads Incompletos (faltan VCPs) */}
      {carryMetrics.metadata?.spreadIncompleto && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">
            <span className="font-medium">Datos incompletos:</span>
            {' '}{carryMetrics.metadata.caucionesSinVCP} de {carryMetrics.metadata.totalCaucionesHistoricas} cauciones sin precios VCP históricos.
            {' '}El spread acumulado puede estar subestimado.
            <Link to="/fci" className="underline hover:text-warning/80 ml-1">
              Cargar precios históricos
            </Link>
          </p>
        </div>
      )}

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          title="Total Caución"
          value={formatARS(carryMetrics.totalCaucion)}
          subValue={
            carryMetrics.metadata?.todasVencidas
              ? `Última: ${formatDateAR(carryMetrics.metadata.ultimaCaucionFecha)}`
              : `${carryMetrics.caucionesVigentes} vigentes`
          }
        />
        <SummaryCard
          title="Saldo FCI"
          value={formatARS(carryMetrics.saldoFCI)}
          subValue={`TNA ${formatPercent(carryMetrics.tnaFCI * 100)}`}
        />
        <SummaryCard
          title="Cobertura"
          value={`${formatNumber(carryMetrics.ratioCobertura, 1)}%`}
          subValue={getCoverageLabel(carryMetrics.ratioCobertura)}
          trend={carryMetrics.ratioCobertura >= 100 ? 1 : -1}
        />
      </div>

      {/* Gráfico de Spread: TNA FCI vs TNA Caución (MA7d) */}
      <RatesEvolutionChart
        fciId={fciId}
        portfolioId={portfolioId}
        userId={userId}
        dataStartDate={dataStartDate}
      />

      {/* Cobertura de Capital + Alertas lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
            <div className={`p-4 rounded-lg border text-center ${
              carryMetrics.ratioCobertura >= 100
                ? 'bg-success/5 border-success/30'
                : 'bg-background-tertiary border-border-secondary'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-2">
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
            <div className={`p-4 rounded-lg border text-center ${
              carryMetrics.ratioCobertura >= 115
                ? 'bg-success/5 border-success/30'
                : 'bg-background-tertiary border-border-secondary'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-2">
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
                Cobertura óptima alcanzada. Podés retirar {formatARS(carryMetrics.saldoFCI - carryMetrics.fciOptimo)} para comprar más activos.
              </p>
            </div>
          )}
          {carryMetrics.ratioCobertura >= 100 && carryMetrics.ratioCobertura < 115 && (
            <div className="p-3 bg-success/5 border border-success/30 rounded-lg">
              <p className="text-success text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Meta 1:1 alcanzada. Faltan {formatARS(carryMetrics.deficitOptimo)} para cobertura óptima.
              </p>
            </div>
          )}

          {/* Cards de Productivo e Improductivo con datos diarios */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-text-secondary">Utilización de Capital</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Productivo */}
              <div className="p-4 bg-success/5 border border-success/20 rounded-lg text-center">
                <p className="text-success text-xs uppercase tracking-wider mb-2">Productivo</p>
                <p className="font-mono font-bold text-xl text-success">{formatARS(carryMetrics.capitalProductivo)}</p>
                <p className="text-success text-xs font-medium mt-1">{formatNumber(carryMetrics.pctProductivo, 1)}%</p>
                <div className="mt-3 pt-3 border-t border-success/20">
                  <p className="text-xs text-text-secondary">
                    Generando:
                    <span className="font-mono font-semibold text-success ml-1">
                      {formatARS(carryMetrics.gananciaProductivaDia)}/día
                    </span>
                  </p>
                </div>
              </div>

              {/* Card Improductivo */}
              <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg text-center">
                <p className="text-danger text-xs uppercase tracking-wider mb-2">Improductivo</p>
                <p className="font-mono font-bold text-xl text-danger">{formatARS(carryMetrics.capitalImproductivo)}</p>
                <p className="text-danger text-xs font-medium mt-1">{formatNumber(carryMetrics.pctImproductivo, 1)}%</p>
                <div className="mt-3 pt-3 border-t border-danger/20">
                  <p className="text-xs text-text-secondary">
                    Perdiendo:
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

      {/* Alertas y Acciones */}
      <Section title="Alertas y Acciones" icon={AlertTriangle}>
        <AlertsPanel carryMetrics={carryMetrics} isFallback={isFallback} spreadStats={spreadStats} />
      </Section>

      </div>

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
