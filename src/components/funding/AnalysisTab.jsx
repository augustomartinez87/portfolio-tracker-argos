import React from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { RatesEvolutionChart } from './RatesEvolutionChart';

/**
 * Pestaña de Análisis - Gráfico de evolución histórica y métricas avanzadas
 * 
 * @param {Object} props
 * @param {Object} props.carryMetrics - Métricas de carry trade
 * @param {string} props.fciId - ID del FCI principal
 * @param {string} props.portfolioId - ID del portfolio actual
 * @param {string} props.userId - ID del usuario
 */
export function AnalysisTab({ carryMetrics, fciId, portfolioId, userId }) {
  return (
    <div className="space-y-8">
      {/* Sección 1: Gráfico de Evolución de Tasas */}
      <RatesEvolutionChart
        fciId={fciId}
        portfolioId={portfolioId}
        userId={userId}
      />

      {/* Información adicional disponible */}
      {carryMetrics && (
        <div className="bg-background-tertiary rounded-xl p-6 border border-border-secondary">
          <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Datos adicionales de la estrategia:
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="space-y-1">
              <p className="text-text-tertiary text-xs uppercase tracking-wider font-semibold">Total operaciones</p>
              <p className="text-lg font-mono font-bold text-text-primary">{carryMetrics.totalOperaciones}</p>
            </div>
            <div className="space-y-1">
              <p className="text-text-tertiary text-xs uppercase tracking-wider font-semibold">Días promedio</p>
              <p className="text-lg font-mono font-bold text-text-primary">{Math.round(carryMetrics.diasPromedio)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-text-tertiary text-xs uppercase tracking-wider font-semibold">Spread acumulado</p>
              <p className="text-lg font-mono font-bold text-success">
                +${(carryMetrics.spreadAcumulado / 1000000).toFixed(2)}M
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-text-tertiary text-xs uppercase tracking-wider font-semibold">Última actualización</p>
              <p className="text-lg font-mono font-bold text-text-primary">
                {new Date(carryMetrics.ultimaActualizacion).toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Próximamente: Más secciones de análisis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
        <div className="bg-background-secondary rounded-xl p-6 border border-border-primary border-dashed">
          <TrendingUp className="w-8 h-8 text-success mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-2">Análisis de Rendimiento</h3>
          <p className="text-xs text-text-tertiary">
            Comparativas mensuales/anuales, tracking de KPIs y métricas de eficiencia (Próximamente)
          </p>
        </div>

        <div className="bg-background-secondary rounded-xl p-6 border border-border-primary border-dashed">
          <Calendar className="w-8 h-8 text-warning mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-2">Histórico de Operaciones</h3>
          <p className="text-xs text-text-tertiary">
            Timeline de cauciones, FCI y eventos relevantes con anotaciones (Próximamente)
          </p>
        </div>
      </div>
    </div>
  );
}

export default AnalysisTab;
