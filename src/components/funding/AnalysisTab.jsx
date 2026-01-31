import React from 'react';
import { BarChart2, Clock, TrendingUp, Calendar } from 'lucide-react';

/**
 * Pestaña de Análisis - Placeholder para análisis histórico y métricas avanzadas
 * 
 * @param {Object} props
 * @param {Object} props.carryMetrics - Métricas de carry trade
 */
export function AnalysisTab({ carryMetrics }) {
  return (
    <div className="space-y-8">
      {/* Header placeholder */}
      <div className="text-center py-12">
        <BarChart2 className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          📈 Análisis histórico
        </h2>
        <p className="text-text-secondary max-w-md mx-auto">
          Próximamente: Métricas avanzadas, análisis de tendencias históricas, 
          comparativas de rendimiento y visualizaciones detalladas de tu estrategia de carry trade.
        </p>
      </div>

      {/* Placeholder cards para futuras funcionalidades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background-secondary rounded-xl p-6 border border-border-primary opacity-60">
          <Clock className="w-8 h-8 text-primary mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-2">Evolución Temporal</h3>
          <p className="text-xs text-text-tertiary">
            Gráficos de evolución de tasas, spreads y rendimientos a lo largo del tiempo
          </p>
        </div>

        <div className="bg-background-secondary rounded-xl p-6 border border-border-primary opacity-60">
          <TrendingUp className="w-8 h-8 text-success mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-2">Análisis de Rendimiento</h3>
          <p className="text-xs text-text-tertiary">
            Comparativas mensuales/anuales, tracking de KPIs y métricas de eficiencia
          </p>
        </div>

        <div className="bg-background-secondary rounded-xl p-6 border border-border-primary opacity-60">
          <Calendar className="w-8 h-8 text-warning mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-2">Histórico de Operaciones</h3>
          <p className="text-xs text-text-tertiary">
            Timeline de cauciones, FCI y eventos relevantes con anotaciones
          </p>
        </div>
      </div>

      {/* Información actual disponible */}
      {carryMetrics && (
        <div className="bg-background-tertiary rounded-xl p-4 border border-border-secondary">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Datos actuales disponibles para análisis:
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-text-tertiary">Total operaciones</p>
              <p className="font-mono font-semibold text-text-primary">{carryMetrics.totalOperaciones}</p>
            </div>
            <div>
              <p className="text-text-tertiary">Días promedio</p>
              <p className="font-mono font-semibold text-text-primary">{Math.round(carryMetrics.diasPromedio)}</p>
            </div>
            <div>
              <p className="text-text-tertiary">Spread acumulado</p>
              <p className="font-mono font-semibold text-text-primary">
                ${(carryMetrics.spreadAcumulado / 1000000).toFixed(2)}M
              </p>
            </div>
            <div>
              <p className="text-text-tertiary">Última actualización</p>
              <p className="font-mono font-semibold text-text-primary">
                {new Date(carryMetrics.ultimaActualizacion).toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisTab;
