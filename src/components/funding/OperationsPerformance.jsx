import React from 'react';
import { BarChart2 } from 'lucide-react';
import { formatARS, formatNumber, formatDateAR } from '@/utils/formatters';
import { Section } from '@/components/common/Section';
import SummaryCard from '@/components/common/SummaryCard';

export function OperationsPerformance({ pnlMetrics, dataStartDate }) {
  if (!pnlMetrics) return null;

  return (
    <Section title="Performance Real" icon={BarChart2}>
      <div className="bg-background-secondary rounded-xl p-4 border border-border-primary space-y-4">
        <p className="text-xs text-text-tertiary">
          Solo operaciones vencidas con datos reales (post {formatDateAR(dataStartDate)}) — {pnlMetrics.totalOps} operaciones
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard
            title="P&L Total"
            value={formatARS(pnlMetrics.pnlTotal)}
            trend={pnlMetrics.pnlTotal}
          />
          <SummaryCard
            title="P&L Mes Actual"
            value={formatARS(pnlMetrics.pnlMesActual)}
            trend={pnlMetrics.pnlMesActual}
          />
          <SummaryCard
            title="P&L Mes Anterior"
            value={formatARS(pnlMetrics.pnlMesAnterior)}
            trend={pnlMetrics.pnlMesAnterior}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-text-tertiary text-xs uppercase tracking-wider">Win Rate</p>
            <p className={`font-mono font-bold text-xl ${pnlMetrics.winRate >= 50 ? 'text-success' : 'text-danger'}`}>
              {formatNumber(pnlMetrics.winRate, 1)}%
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              {Math.round(pnlMetrics.totalOps * pnlMetrics.winRate / 100)}/{pnlMetrics.totalOps} ganadoras
            </p>
          </div>
          <div className="text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-text-tertiary text-xs uppercase tracking-wider">Spread Promedio</p>
            <p className={`font-mono font-bold text-xl ${pnlMetrics.spreadPromedio >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatARS(pnlMetrics.spreadPromedio)}
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">por operación</p>
          </div>
          <div className="text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-text-tertiary text-xs uppercase tracking-wider">Mejor Op.</p>
            <p className="font-mono font-bold text-xl text-success">
              {formatARS(pnlMetrics.mejor.spread)}
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">{pnlMetrics.mejor.fecha}</p>
          </div>
          <div className="text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-text-tertiary text-xs uppercase tracking-wider">Peor Op.</p>
            <p className="font-mono font-bold text-xl text-danger">
              {formatARS(pnlMetrics.peor.spread)}
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">{pnlMetrics.peor.fecha}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
