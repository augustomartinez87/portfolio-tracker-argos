import React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function MetricCard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  className,
  highlight = false
}) {
  return (
    <div className={clsx(
      'group relative overflow-hidden rounded-custom border transition-all duration-300',
      highlight 
        ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 shadow-lg shadow-primary/10' 
        : 'bg-slate-800 border-slate-700 hover:border-slate-600',
      className
    )}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">{label}</p>
            <h2 className="text-3xl font-mono font-bold text-white">
              {value}
            </h2>
            {subtitle && (
              <p className="text-sm font-mono text-slate-300 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div className={clsx(
              'p-3 rounded-lg transition-all duration-300',
              highlight ? 'bg-primary/20' : 'bg-slate-700/50 group-hover:bg-primary/20'
            )}>
              <Icon className={clsx(
                'w-6 h-6 transition-colors',
                highlight ? 'text-primary' : 'text-slate-400 group-hover:text-primary'
              )} />
            </div>
          )}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'text-sm font-mono font-semibold flex items-center gap-1',
                trend >= 0 ? 'text-success' : 'text-danger'
              )}
            >
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      {highlight && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-primary" />
      )}
    </div>
  );
}
