import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Tarjeta de métrica con estado visual
 *
 * @param {Object} props
 * @param {string} props.title - Título de la métrica
 * @param {string} props.value - Valor principal a mostrar
 * @param {string|React.ReactNode} props.subtitle - Subtítulo o componente adicional
 * @param {React.ComponentType} props.icon - Icono de Lucide
 * @param {'success'|'warning'|'danger'|'info'|'neutral'} props.status - Estado visual
 * @param {number} props.trend - Valor de tendencia (positivo/negativo)
 * @param {boolean} props.loading - Estado de carga
 * @param {string} props.tooltip - Tooltip opcional
 */
export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  status = 'neutral',
  trend,
  loading = false,
  tooltip
}) {
  const statusColors = {
    success: 'border-l-success bg-success/5',
    warning: 'border-l-warning bg-warning/5',
    danger: 'border-l-danger bg-danger/5',
    info: 'border-l-primary bg-primary/5',
    neutral: 'border-l-border-secondary bg-background-tertiary',
  };

  const iconBgColors = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-primary/10 text-primary',
    neutral: 'bg-background-tertiary text-text-secondary',
  };

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : null;
  const trendColor = trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-tertiary';

  if (loading) {
    return (
      <div className={`bg-background-secondary rounded-lg p-4 border border-border-primary border-l-4 ${statusColors.neutral} animate-pulse`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-3 w-20 bg-background-tertiary rounded mb-2" />
            <div className="h-8 w-32 bg-background-tertiary rounded mb-1" />
            <div className="h-3 w-24 bg-background-tertiary rounded" />
          </div>
          <div className="w-9 h-9 bg-background-tertiary rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-background-secondary rounded-lg p-4 border border-border-primary border-l-4 ${statusColors[status] || statusColors.neutral}`}
      title={tooltip}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold font-mono text-text-primary">{value}</p>
          {subtitle && (
            <div className={`text-xs mt-1 ${trendColor}`}>
              {TrendIcon && <TrendIcon className="inline w-3 h-3 mr-1" />}
              {subtitle}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBgColors[status] || iconBgColors.neutral}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
