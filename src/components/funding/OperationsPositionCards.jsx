import React from 'react';
import { TrendingUp, TrendingDown, Receipt, Info, Target } from 'lucide-react';
import { formatARS, formatNumber } from '@/utils/formatters';
import { MetricCard } from '@/components/common/MetricCard';

import { formatPercent } from '@/utils/formatters';

export function OperationsPositionCards({ totals, hasTodayPrice, todayStr, fciDailyPnl = 0, fciDailyPnlPct = 0 }) {
  // Configurar subtítulo de PNL
  const pnlColor = fciDailyPnl >= 0 ? 'text-success' : 'text-danger';
  const sign = fciDailyPnl > 0 ? '+' : '';
  const pnlSubtitle = hasTodayPrice
    ? (
      <span className={pnlColor}>
        {sign}{formatARS(fciDailyPnl)} ({sign}{formatPercent(fciDailyPnlPct * 100)})
      </span>
    )
    : "Saldo actual";

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-text-primary">Posición Actual</h3>
        <span className="text-xs text-text-tertiary bg-background-tertiary px-2 py-0.5 rounded-full">
          {totals.cantVigentes} vigente{totals.cantVigentes !== 1 ? 's' : ''}
        </span>
      </div>

      {!hasTodayPrice && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
          <Info className="w-4 h-4" />
          <span>No hay VCP de hoy ({todayStr}). El PnL diario se muestra en 0.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Valuación FCI"
          value={formatARS(totals.valuation)}
          subtitle={pnlSubtitle}
          icon={TrendingUp}
          status="info"
        />
        <MetricCard
          title="Capital financiado"
          value={formatARS(totals.capitalVigente)}
          subtitle={`${totals.cantVigentes} caución${totals.cantVigentes !== 1 ? 'es' : ''} vigente${totals.cantVigentes !== 1 ? 's' : ''}`}
          icon={Receipt}
          status="info"
        />
        <MetricCard
          title="Intereses vigentes"
          value={formatARS(totals.interesesVigentes)}
          subtitle="Costo cauciones activas"
          icon={TrendingDown}
          status="warning"
        />
        <MetricCard
          title="Cobertura"
          value={formatARS(totals.cobertura)}
          subtitle={totals.capitalVigente > 0 ? `Ratio: ${formatNumber(totals.coberturaRatio, 1)}%` : 'Sin caución activa'}
          icon={Target}
          status={totals.cobertura >= 0 ? 'success' : 'danger'}
        />
      </div>
    </div>
  );
}
