import React, { memo } from 'react';
import { formatARS } from '@/utils/formatters';

const SummaryCard = memo(({ title, value, subValue, icon: Icon, trend, dailyChange, isLoading, highlight, showBadge, badgeValue }) => {
  const getTrendColor = (value) => {
    if (value === undefined || value === null || value === 0) return 'text-text-tertiary';
    return value >= 0 ? 'text-success' : 'text-danger';
  };

  return (
    <div className={`bg-background-secondary rounded-lg p-2 sm:p-2.5 border transition-all duration-200 ${highlight ? 'border-primary/50' : 'border-border-primary hover:border-border-secondary'
      }`}>
      <div className="flex flex-col items-center justify-center text-center">
        <p className="text-text-tertiary text-[10px] font-semibold uppercase tracking-wider mb-0.5">{title}</p>
        {isLoading ? (
          <div className="space-y-1 w-full">
            <div className="h-6 bg-background-tertiary animate-pulse rounded w-3/4 mx-auto"></div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center w-full">
              {showBadge && badgeValue && (
                <span className={`mb-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center ${trend >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}>
                  {badgeValue}
                </span>
              )}
              <p className={`text-sm sm:text-xl font-bold font-mono tracking-tight whitespace-nowrap px-1 ${trend !== undefined ? getTrendColor(trend) : 'text-text-primary'}`}>
                {value}
              </p>
            </div>
            {subValue && !showBadge && (
              <p className={`text-[10px] mt-0.5 font-medium ${trend !== undefined ? getTrendColor(trend) : 'text-text-tertiary'}`}>
                {subValue}
              </p>
            )}
          </>
        )}
      </div>

      {dailyChange !== undefined && dailyChange !== 0 && (
        <div className="mt-3 pt-3 border-t border-border-primary flex justify-between items-center">
          <span className="text-[10px] text-text-tertiary">P&L del día:</span>
          <span className={`text-sm font-mono font-medium ${dailyChange >= 0 ? 'text-success' : 'text-danger'
            }`}>
            {dailyChange >= 0 ? '+' : ''}{formatARS(dailyChange)}
          </span>
        </div>
      )}
    </div>
  );
});

SummaryCard.displayName = 'SummaryCard';

export default SummaryCard;
