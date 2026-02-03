import React from 'react';
import { formatPercent } from '@/utils/formatters';

/**
 * Barra de progreso visual simple
 *
 * @param {Object} props
 * @param {number} props.value - Valor actual
 * @param {number} props.max - Valor máximo
 * @param {string} props.label - Etiqueta opcional
 * @param {'primary'|'success'|'warning'|'danger'} props.color - Color de la barra
 */
export function ProgressBar({ value, max, label, color = 'primary' }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colors = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-text-tertiary">{label}</span>
          <span className="text-text-secondary font-mono">
            {formatPercent(percentage - 100).replace('+', '')}
          </span>
        </div>
      )}
      <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color] || colors.primary} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
