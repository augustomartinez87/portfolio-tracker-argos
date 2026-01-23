import React, { memo } from 'react';
import { DollarSign, TrendingUp, Percent } from 'lucide-react';
import { formatARS, formatPercent } from '../../utils/formatters';

const MetricCard = memo(({ title, value, icon: Icon, loading }) => {
  if (loading) {
    return (
      <div className="bg-background-secondary rounded-lg p-4 border border-border-primary">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-background-tertiary rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-3 bg-background-tertiary rounded w-20 mb-2 animate-pulse" />
            <div className="h-6 bg-background-tertiary rounded w-32 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary rounded-lg p-4 border border-border-primary hover:border-border-secondary transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
          <Icon className="w-5 h-5 text-text-tertiary" />
        </div>
        <div>
          <p className="text-text-tertiary text-xs font-medium">{title}</p>
          <p className="text-text-primary text-xl font-semibold font-mono mt-0.5">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

const SpreadCards = ({ metrics, loading }) => {
  if (!metrics && !loading) {
    return null;
  }

  const capitalTotal = metrics?.capitalTotal || 0;
  const interesTotal = metrics?.interesTotal || 0;
  const tnaPromedio = metrics?.tnaPromedioPonderada || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        title="Capital caucionado"
        value={formatARS(capitalTotal)}
        icon={DollarSign}
        loading={loading}
      />
      <MetricCard
        title="Interés total pagado"
        value={formatARS(interesTotal)}
        icon={TrendingUp}
        loading={loading}
      />
      <MetricCard
        title="TNA promedio ponderada"
        value={formatPercent(tnaPromedio / 100, 2)}
        icon={Percent}
        loading={loading}
      />
    </div>
  );
};

export default SpreadCards;
