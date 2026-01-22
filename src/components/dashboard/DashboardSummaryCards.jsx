import React from 'react';
import SummaryCard from '../common/SummaryCard';
import { formatARS, formatPercent } from '../../utils/formatters';

export const DashboardSummaryCards = ({ totals, lastUpdate }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <SummaryCard
        title="Invertido"
        value={formatARS(totals.invertido)}
        subtitle="Total invertido"
      />
      <SummaryCard
        title="Valuación"
        value={formatARS(totals.valuacion)}
        subtitle={lastUpdate ? `Actualizado: ${lastUpdate}` : ''}
      />
      <SummaryCard
        title="P&L"
        value={formatARS(totals.resultado)}
        trend={totals.resultado}
        showBadge
        badgeValue={formatPercent(totals.resultadoPct)}
      />
      <SummaryCard
        title="P&L Hoy"
        value={formatARS(totals.resultadoDiario)}
        trend={totals.resultadoDiario}
        showBadge
        badgeValue={formatPercent(totals.resultadoDiarioPct)}
      />
    </div>
  );
};

export default DashboardSummaryCards;
