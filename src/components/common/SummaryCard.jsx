import React, { memo } from 'react';

const SummaryCard = memo(({ title, value, subValue, icon: Icon, trend, dailyChange, isLoading, highlight }) => {
  const getTrendColor = (value) => {
    if (value === undefined || value === null || value === 0) return 'text-slate-400';
    return value >= 0 ? 'text-success' : 'text-danger';
  };

  return (
    <div className={`bg-slate-800/95 rounded-custom p-5 border transition-all duration-300 hover:shadow-lg ${
      highlight ? 'border-primary/50 shadow-primary/20 ring-1 ring-primary/30' : 'border-slate-700/50 hover:border-slate-600'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-sm font-medium mb-2">{title}</p>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 bg-slate-700 animate-pulse rounded w-3/4"></div>
              <div className="h-4 bg-slate-700 animate-pulse rounded w-1/2"></div>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-white font-mono tracking-tight truncate">
                {value}
              </p>
              {subValue && (
                <p className={`text-sm mt-1 font-semibold ${getTrendColor(trend)}`}>
                  {subValue}
                </p>
              )}
              {dailyChange !== undefined && dailyChange !== 0 && (
                <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                  dailyChange >= 0 ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'
                }`}>
                  {dailyChange >= 0 ? '+' : ''}{dailyChange.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              )}
            </>
          )}
        </div>
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${
          trend > 0 ? 'bg-success/15' :
          trend < 0 ? 'bg-danger/15' :
          'bg-slate-700/50'
        }`}>
          <Icon className={`w-5 h-5 ${
            trend > 0 ? 'text-success' :
            trend < 0 ? 'text-danger' :
            'text-slate-400'
          }`} />
        </div>
      </div>
    </div>
  );
});

SummaryCard.displayName = 'SummaryCard';

export default SummaryCard;
