import React, { useState, memo } from 'react';
import { ChevronDown, ChevronUp, Info, TrendingUp, Calendar, Activity } from 'lucide-react';
import { formatPercent } from '@/utils/formatters';

/**
 * Component to display performance metrics (XIRR, YTD, TWR)
 * Renders as a collapsible section below the main summary cards
 */
export const PerformanceMetricsCards = memo(({ metrics, isLoading = false }) => {
  const [expanded, setExpanded] = useState(true);

  // Check if we have any valid metrics to display
  const hasAnyMetric = metrics &&
    (metrics.xirr?.value !== null ||
      metrics.ytd?.value !== null ||
      metrics.twr?.value !== null);

  // Get overall error if present
  const hasError = metrics?.error ||
    metrics?.xirr?.error ||
    metrics?.ytd?.error ||
    metrics?.twr?.error;

  return (
    <div className="bg-background-secondary border border-border-primary rounded-lg overflow-hidden mt-3">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-background-tertiary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-text-primary">Rendimiento</span>
          <span className="text-[10px] text-text-tertiary bg-background-tertiary px-1.5 py-0.5 rounded-full font-medium">
            BETA
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-text-tertiary" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
        )}
      </button>

      {/* Collapsible content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1">
          <div className="grid grid-cols-3 gap-2">
            {/* XIRR Card */}
            <MetricCard
              icon={TrendingUp}
              title="XIRR"
              tooltip="Retorno ponderado por dinero (TIR). Considera el timing exacto de cada compra y venta."
              metric={metrics?.xirr}
              isLoading={isLoading || metrics?.isLoading}
            />

            {/* YTD Card */}
            <MetricCard
              icon={Calendar}
              title="YTD"
              tooltip="Year-to-Date. Retorno acumulado desde el 1 de enero de este año."
              metric={metrics?.ytd}
              isLoading={isLoading || metrics?.isLoading}
            />

            {/* TWR Card */}
            <MetricCard
              icon={Activity}
              title="TWR"
              tooltip="Time Weighted Return. Elimina el efecto de aportes y retiros para medir el rendimiento puro."
              metric={metrics?.twr}
              isLoading={isLoading || metrics?.isLoading}
            />
          </div>

          {/* Error/Warning message */}
          {hasError && (
            <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded-md">
              <p className="text-warning text-[10px]">
                {metrics?.error || metrics?.xirr?.error || metrics?.ytd?.error || metrics?.twr?.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Individual metric card component
 */
const MetricCard = memo(({ icon: Icon, title, tooltip, metric, isLoading }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const value = metric?.value;
  const warning = metric?.warning;
  const hasValue = value !== null && value !== undefined;

  const getValueColor = (val) => {
    if (val === null || val === undefined) return 'text-text-tertiary';
    return val >= 0 ? 'text-success' : 'text-danger';
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  return (
    <div className="bg-background-tertiary rounded-md p-2 relative">
      {/* Header with icon and info */}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
          {title}
        </span>
        <div className="relative ml-auto">
          <button
            className="text-text-tertiary hover:text-text-secondary p-0.5"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <Info className="w-2.5 h-2.5" />
          </button>

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute right-0 top-full mt-1 z-20 w-44 p-2 bg-background-secondary border border-border-primary rounded-md shadow-lg text-[10px] text-text-secondary leading-tight">
              {tooltip}
              {warning && (
                <div className="mt-1 pt-1 border-t border-border-primary text-warning">
                  {warning}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Value */}
      {isLoading ? (
        <div className="h-5 bg-background-secondary animate-pulse rounded w-14"></div>
      ) : (
        <p className={`text-base font-bold font-mono ${getValueColor(value)}`}>
          {formatValue(value)}
        </p>
      )}

      {/* Warning indicator */}
      {!isLoading && warning && !showTooltip && (
        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-warning rounded-full" title={warning}></div>
      )}
    </div>
  );
});

MetricCard.displayName = 'MetricCard';
PerformanceMetricsCards.displayName = 'PerformanceMetricsCards';

export default PerformanceMetricsCards;
