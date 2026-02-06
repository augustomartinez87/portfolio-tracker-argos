import React from 'react';
import { Sliders, Sparkles, Percent } from 'lucide-react';
import { ScenarioSimulator } from './ScenarioSimulator';
import { CompoundProjection } from './CompoundProjection';
import { Section } from '@/components/common/Section';
import { formatPercent, formatNumber } from '@/utils/formatters';

export function AnalysisTab({ carryMetrics, ultimaPreciofecha }) {
  return (
    <div className="space-y-6">
      {/* Análisis de Tasas */}
      <Section title="Análisis de Tasas" icon={Percent}>
        <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-background-tertiary rounded-lg">
              <p className="text-text-tertiary text-xs uppercase tracking-wider">TNA FCI</p>
              <p className="font-mono font-bold text-xl text-success">{formatPercent(carryMetrics.tnaFCI * 100)}</p>
              {ultimaPreciofecha && (
                <p className="text-[10px] text-text-tertiary mt-1">Dato del {ultimaPreciofecha}</p>
              )}
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
    </div>
  );
}

export default AnalysisTab;
