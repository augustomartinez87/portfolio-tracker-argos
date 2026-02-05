import React from 'react';

// Props base para CartesianGrid
export const gridProps = {
  strokeDasharray: '3 3',
  stroke: 'var(--border-primary)',
  vertical: false,
};

// Props base para ejes
export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: 'var(--text-tertiary)', fontSize: 10 },
};

// Props para líneas (sin stroke - el color viene del caller)
export const getLineProps = (color: string) => ({
  type: 'monotone',
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 5, stroke: color, strokeWidth: 2, fill: 'var(--bg-primary)' },
});

// Props para áreas de gradiente (invisibles, solo muestran el gradiente)
export const getAreaGradientProps = (gradientId: string) => ({
  type: 'monotone',
  fill: `url(#${gradientId})`,
  stroke: 'transparent',
  legendType: 'none' as const,
});

// Crear definición de gradiente
export const createGradientDef = (id: string, color: string, topOpacity = 0.15) => ({
  id,
  color,
  topOpacity,
  bottomOpacity: 0,
  topOffset: '5%',
  bottomOffset: '95%',
});

// Props para Legend
export const legendProps = {
  verticalAlign: 'top' as const,
  height: 36,
  iconType: 'circle' as const,
};

// Paleta de colores base
export const CHART_COLORS = {
  success: 'var(--color-success)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  accent: 'var(--color-accent)', // indigo
};

// Tipos para Tooltip
interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (label: string | number | undefined) => string;
  valueFormatter?: (value: number | string, name: string) => string;
}

// Componente Tooltip reutilizable
export const ChartTooltip: React.FC<ChartTooltipProps> = ({ 
  active, 
  payload, 
  label, 
  labelFormatter, 
  valueFormatter 
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-background-tertiary border border-border-primary p-3 rounded-lg shadow-xl backdrop-blur-md">
      <p className="text-xs text-text-tertiary mb-2 font-medium">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <div className="space-y-1">
        {payload.map((entry: TooltipPayloadItem, index: number) => (
          <div key={index} className="flex justify-between gap-4">
            <span className="text-xs font-medium" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="text-xs font-mono font-bold text-text-primary">
              {valueFormatter ? valueFormatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default {
  gridProps,
  axisProps,
  getLineProps,
  getAreaGradientProps,
  createGradientDef,
  legendProps,
  CHART_COLORS,
  ChartTooltip,
};
