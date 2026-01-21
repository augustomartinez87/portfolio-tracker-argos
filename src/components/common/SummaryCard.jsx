import React, { memo } from 'react';

const SummaryCard = memo(({ title, value, subValue, icon: Icon, trend, dailyChange, isLoading, highlight }) => {
  const getTrendColor = (value) => {
    if (value === undefined || value === null || value === 0) return 'text-slate-400';
    return value >= 0 ? 'text-success' : 'text-danger';
  };

  return (
    <div className={`bg-slate-800/95 rounded-custom p-3 border transition-all duration-300 hover:shadow-lg ${
      highlight ? 'border-primary/50 shadow-primary/20 ring-1 ring-primary/30' : 'border-slate-700/50 hover:border-slate-600'
    }`}>
      <div className="flex flex-col items-center justify-center h-full text-center min-h-[70px]">
        <p className="text-slate-400 text-xs font-medium mb-1">{title}</p>
        {isLoading ? (
          <div className="space-y-1 w-full">
            <div className="h-6 bg-slate-700 animate-pulse rounded w-3/4 mx-auto"></div>
            <div className="h-3 bg-slate-700 animate-pulse rounded w-1/2 mx-auto"></div>
          </div>
        ) : (
          <>
            <p className="text-xl font-bold text-white font-mono tracking-tight">
              {value}
            </p>
            {subValue && (
              <p className={`text-xs mt-0.5 font-semibold ${getTrendColor(trend)}`}>
                {subValue}
              </p>
            )}
          </>
        )}
      </div>
      
      {dailyChange !== undefined && dailyChange !== 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between items-end absolute bottom-3 left-3 right-3">
          <span className="text-[10px] text-slate-500">P&L del día:</span>
          <span className={`text-xs font-mono font-semibold ${
            dailyChange >= 0 ? 'text-success' : 'text-danger'
          }`}>
            {dailyChange >= 0 ? '+' : ''}{dailyChange.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
});

SummaryCard.displayName = 'SummaryCard';

export default SummaryCard;
