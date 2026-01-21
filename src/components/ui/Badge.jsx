import React from 'react';
import { clsx } from 'clsx';

export function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold',
        {
          'bg-success/10 text-success border border-success/20': variant === 'success',
          'bg-danger/10 text-danger border border-danger/20': variant === 'danger',
          'bg-warning/10 text-warning border border-warning/20': variant === 'warning',
          'bg-primary/10 text-primary border border-primary/20': variant === 'info',
          'bg-slate-700 text-slate-300 border border-slate-600': variant === 'default',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
