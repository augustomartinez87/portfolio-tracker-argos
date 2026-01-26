import React from 'react';
import SummaryCard from '../common/SummaryCard';
import { formatARS, formatUSD, formatPercent } from '../../utils/formatters';
import { PercentageDisplay } from '../common/PercentageDisplay';

export const DashboardSummaryCards = ({ totals, lastUpdate, isLoading = false, currency = 'ARS' }) => {
  const formatValue = (arsValue, usdValue) => {
    if (isLoading) return '---';
    return currency === 'ARS' ? formatARS(arsValue) : formatUSD(usdValue);
  };

  const formatBadgeValue = (arsValue, usdValue, pct) => {
    if (isLoading) return '...';
    return <PercentageDisplay value={pct} className="!text-current" iconSize="w-2.5 h-2.5" />;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <SummaryCard
        title="Invertido"
        value={formatValue(totals.invertido, totals.invertidoUSD)}
        subtitle="Total invertido"
      />
      <SummaryCard
        title="Valuación"
        value={formatValue(totals.valuacion, totals.valuacionUSD)}
        subtitle={isLoading ? 'Actualizando precios...' : (lastUpdate ? `Actualizado: ${lastUpdate}` : '')}
      />
      <SummaryCard
        title="P&L"
        value={formatValue(totals.resultado, totals.resultadoUSD)}
        trend={isLoading ? 0 : (currency === 'ARS' ? totals.resultado : totals.resultadoUSD)}
        showBadge
        badgeValue={formatBadgeValue(totals.resultado, totals.resultadoUSD, currency === 'ARS' ? totals.resultadoPct : totals.resultadoPctUSD)}
      />
      <SummaryCard
        title="P&L Hoy"
        value={formatValue(totals.resultadoDiario, totals.resultadoDiarioUSD)}
        trend={isLoading ? 0 : (currency === 'ARS' ? totals.resultadoDiario : totals.resultadoDiarioUSD)}
        showBadge
        badgeValue={formatBadgeValue(totals.resultadoDiario, totals.resultadoDiarioUSD, currency === 'ARS' ? totals.resultadoDiarioPct : totals.resultadoDiarioPctUSD)}
      />
    </div>
  );
};

export default DashboardSummaryCards;
