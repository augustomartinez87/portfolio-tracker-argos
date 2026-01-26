import React from 'react';
import SummaryCard from '../common/SummaryCard';
import { formatARS, formatPercent } from '../../utils/formatters';
import { PercentageDisplay } from '../common/PercentageDisplay';

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
        badgeValue={<PercentageDisplay value={totals.resultadoPct} className="!text-current" iconSize="w-2.5 h-2.5" />}
      />
      <SummaryCard
        title="P&L Hoy"
        value={formatARS(totals.resultadoDiario)}
        trend={totals.resultadoDiario}
        showBadge
        badgeValue={<PercentageDisplay value={totals.resultadoDiarioPct} className="!text-current" iconSize="w-2.5 h-2.5" />}
      />
    </div>
  );
};

export default DashboardSummaryCards;
