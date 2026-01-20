// src/components/common/SummaryCard.jsx
import React, { memo } from 'react';

const SummaryCard = memo(({ title, value, subValue, icon: Icon, trend, isLoading, highlight }) => {
  const getTrendColor = (value) => {
    if (value === undefined || value === null || value === 0) return 'text-slate-400';
    return value >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className={`bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border transition-all duration-300 hover:shadow-lg ${
      highlight ? 'border-emerald-500/50 shadow-emerald-500/20 ring-1 ring-emerald-500/30' : 'border-slate-700/50 hover:border-slate-600'
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
              <p className="text-2xl font-bold text-white font-mono tracking-tight truncate" title={value}>
                {value}
              </p>
              {subValue && (
                <p className={`text-sm mt-1 font-semibold ${getTrendColor(trend)}`}>
                  {subValue}
                </p>
              )}
            </>
          )}
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 ${
          trend > 0 ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30' :
          trend < 0 ? 'bg-red-500/15 ring-1 ring-red-500/30' :
          'bg-slate-700/50'
        }`}>
          <Icon className={`w-6 h-6 ${
            trend > 0 ? 'text-emerald-400' :
            trend < 0 ? 'text-red-400' :
            'text-slate-400'
          }`} />
        </div>
      </div>
    </div>
  );
});

SummaryCard.displayName = 'SummaryCard';

export default SummaryCard;
