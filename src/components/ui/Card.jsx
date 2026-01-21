import React from 'react';
import { cn } from '../utils/cn';

export function Card({ children, className, glass = false, noPadding = false }) {
  return (
    <div
      className={cn(
        'rounded-custom border transition-all duration-200',
        glass
          ? 'bg-slate-800/80 backdrop-blur-xl border-slate-700/50 shadow-xl'
          : 'bg-slate-800 border-slate-700 shadow-lg',
        !noPadding && 'p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-start justify-between mb-6', className)}>
      <div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
