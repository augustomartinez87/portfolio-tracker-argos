import React from 'react';
import { CheckCircle, AlertTriangle, Shield } from 'lucide-react';

/**
 * Badge de estado visual
 *
 * @param {Object} props
 * @param {string} props.status - Clave del estado (determina estilo e icono)
 * @param {string} props.label - Texto a mostrar (opcional, usa status si no se provee)
 */
export function StatusBadge({ status, label }) {
  const styles = {
    // Estados de cobertura
    sobrecapitalizado: 'bg-success/10 text-success border-success/30',
    optimo: 'bg-success/10 text-success border-success/30',
    ajustado: 'bg-warning/10 text-warning border-warning/30',
    deficit: 'bg-danger/10 text-danger border-danger/30',
    // Estados de spread
    'optimo-spread': 'bg-success/10 text-success border-success/30',
    'saludable-spread': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'ajustado-spread': 'bg-warning/10 text-warning border-warning/30',
    'critico-spread': 'bg-orange-100 text-orange-700 border-orange-300',
    'negativo-spread': 'bg-danger/10 text-danger border-danger/30',
    // Estados legacy
    amplio: 'bg-success/10 text-success border-success/30',
    medio: 'bg-primary/10 text-primary border-primary/30',
    estrecho: 'bg-warning/10 text-warning border-warning/30',
    critico: 'bg-danger/10 text-danger border-danger/30',
    // Estados genéricos
    success: 'bg-success/10 text-success border-success/30',
    'success-light': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
    info: 'bg-primary/10 text-primary border-primary/30',
    neutral: 'bg-background-tertiary text-text-secondary border-border-primary',
  };

  const icons = {
    sobrecapitalizado: CheckCircle,
    optimo: CheckCircle,
    ajustado: AlertTriangle,
    deficit: AlertTriangle,
    'optimo-spread': CheckCircle,
    'saludable-spread': CheckCircle,
    'ajustado-spread': AlertTriangle,
    'critico-spread': AlertTriangle,
    'negativo-spread': AlertTriangle,
    amplio: Shield,
    medio: Shield,
    estrecho: AlertTriangle,
    critico: AlertTriangle,
    success: CheckCircle,
    'success-light': CheckCircle,
    warning: AlertTriangle,
    danger: AlertTriangle,
    info: Shield,
    neutral: Shield,
  };

  const Icon = icons[status] || Shield;
  const styleClass = styles[status] || styles.neutral;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styleClass}`}>
      <Icon className="w-3 h-3" />
      {label || status}
    </span>
  );
}

export default StatusBadge;
