import React from 'react';
import SummaryCard from '@/components/common/SummaryCard';
import { formatARS, formatUSD, formatPercent } from '@/utils/formatters';
import { PercentageDisplay } from '@/components/common/PercentageDisplay';

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
        value={formatValue(totals.invested, totals.investedUSD)}
        subtitle="Total invertido"
      />
      <SummaryCard
        title="Valuación"
        value={formatValue(totals.valuation, totals.valuationUSD)}
        subtitle={isLoading ? 'Actualizando precios...' : (lastUpdate ? `Actualizado: ${lastUpdate}` : '')}
      />
      <SummaryCard
        title="P&L"
        value={formatValue(totals.result, totals.resultUSD)}
        trend={isLoading ? 0 : (currency === 'ARS' ? totals.result : totals.resultUSD)}
        showBadge
        badgeValue={formatBadgeValue(totals.result, totals.resultUSD, currency === 'ARS' ? totals.resultPct : totals.resultPctUSD)}
      />
      <SummaryCard
        title="P&L Hoy"
        value={formatValue(totals.dailyResult, totals.dailyResultUSD)}
        trend={isLoading ? 0 : (currency === 'ARS' ? totals.dailyResult : totals.dailyResultUSD)}
        showBadge
        badgeValue={formatBadgeValue(totals.dailyResult, totals.dailyResultUSD, currency === 'ARS' ? totals.dailyResultPct : totals.dailyResultPctUSD)}
      />
    </div>
  );
};

export default DashboardSummaryCards;
