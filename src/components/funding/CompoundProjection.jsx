import React, { useMemo } from 'react';
import Decimal from 'decimal.js';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { formatARS, formatNumber, formatCompactNumber } from '@/utils/formatters';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  gridProps,
  axisProps,
  createGradientDef,
  ChartTooltip,
} from '@/utils/chartTheme';

/**
 * Proyección de Interés Compuesto para Carry Trade
 * Muestra cómo crecería el capital con capitalización diaria
 * 
 * @param {Object} props
 * @param {number} props.capitalProductivo - Capital inicial para proyección
 * @param {number} props.bufferTasa - Spread TNA como decimal (ej: 0.0027 para 0.27%)
 */
export function CompoundProjection({ capitalProductivo, bufferTasa }) {
  // Cálculos de proyección usando Decimal.js para precisión
  // Capitalización diaria: tasaDiaria = (1 + TNA)^(1/365) - 1
  const proyecciones = useMemo(() => {
    const capitalInicial = new Decimal(capitalProductivo || 0);
    const spreadDecimal = new Decimal(bufferTasa || 0);

    if (capitalInicial.isZero() || spreadDecimal.isZero()) {
      return null;
    }

    // Tasa diaria = (1 + spread)^(1/365) - 1
    const tasaDiaria = new Decimal(1).plus(spreadDecimal).pow(new Decimal(1).dividedBy(365)).minus(1);

    // Función para calcular proyección a N días: C * (1 + r_diaria)^dias
    const calcularProyeccion = (dias) => {
      const factor = new Decimal(1).plus(tasaDiaria).pow(dias);
      const capitalFinal = capitalInicial.times(factor);
      const ganancia = capitalFinal.minus(capitalInicial);
      const porcentajeGanancia = ganancia.dividedBy(capitalInicial).times(100);

      return {
        capitalFinal: capitalFinal.toNumber(),
        ganancia: ganancia.toNumber(),
        porcentajeGanancia: porcentajeGanancia.toNumber(),
      };
    };

    // Calcular proyecciones para 3, 6 y 12 meses (usando días reales)
    const proyeccion3m = calcularProyeccion(91);   // ~3 meses
    const proyeccion6m = calcularProyeccion(182);  // ~6 meses
    const proyeccion12m = calcularProyeccion(365); // 12 meses

    // Generar datos para el gráfico (meses 0-12, usando días)
    const datosGrafico = [];
    for (let mes = 0; mes <= 12; mes++) {
      const dias = Math.round(mes * 365 / 12);
      const factor = new Decimal(1).plus(tasaDiaria).pow(dias);
      const capital = capitalInicial.times(factor);
      datosGrafico.push({
        mes,
        capital: capital.toNumber(),
        capitalFormatted: formatCompactNumber(capital.toNumber()),
      });
    }

    return {
      proyeccion3m,
      proyeccion6m,
      proyeccion12m,
      datosGrafico,
      isPositiveGrowth: spreadDecimal.gt(0),
      isLowGrowth: spreadDecimal.gt(0) && spreadDecimal.lt(0.005),
    };
  }, [capitalProductivo, bufferTasa]);

  // Componente para card de proyección
  const ProjectionCard = ({ titulo, proyeccion }) => {
    const isPositive = proyeccion.ganancia >= 0;
    const colorClass = isPositive ? 'text-success' : 'text-danger';
    const borderClass = isPositive ? 'border-success/30' : 'border-danger/30';
    const bgClass = isPositive ? 'bg-success/5' : 'bg-danger/5';
    
    return (
      <div className={`p-4 rounded-lg border ${borderClass} ${bgClass}`}>
        <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">{titulo}</p>
        <p className="text-lg font-bold font-mono text-text-primary mb-2">
          {formatARS(proyeccion.capitalFinal)}
        </p>
        <div className="space-y-1">
          <p className={`text-sm font-medium ${colorClass}`}>
            {isPositive ? '+' : ''}{formatARS(proyeccion.ganancia)}
          </p>
          <p className={`text-xs ${colorClass}`}>
            ({isPositive ? '+' : ''}{formatNumber(proyeccion.porcentajeGanancia, 1)}%)
          </p>
        </div>
      </div>
    );
  };

  // Si no hay datos suficientes
  if (!proyecciones) {
    return (
      <div className="bg-background-secondary rounded-xl p-4 border border-border-primary">
        <p className="text-sm text-text-tertiary text-center">
          No hay datos suficientes para generar proyecciones
        </p>
      </div>
    );
  }

  const { proyeccion3m, proyeccion6m, proyeccion12m, datosGrafico, isPositiveGrowth, isLowGrowth } = proyecciones;

  // Determinar color de la línea según el tipo de crecimiento
  const lineColor = isPositiveGrowth ? 'var(--color-success)' : 'var(--color-danger)'; // success o danger
  const areaColor = isPositiveGrowth ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <div className="space-y-6">
      {/* Subtítulo */}
      <p className="text-sm text-text-secondary">
        Capitalización diaria al spread actual ({formatNumber(bufferTasa * 100, 2)}% TNA)
      </p>

      {/* Cards de proyección */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProjectionCard titulo="3 MESES" proyeccion={proyeccion3m} />
        <ProjectionCard titulo="6 MESES" proyeccion={proyeccion6m} />
        <ProjectionCard titulo="12 MESES" proyeccion={proyeccion12m} />
      </div>

      {/* Aviso de crecimiento bajo */}
      {isLowGrowth && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <Info className="w-4 h-4 text-warning" />
          <p className="text-sm text-warning">
            ℹ️ Con un spread bajo, el crecimiento compuesto es limitado
          </p>
        </div>
      )}

      {/* Gráfico de evolución */}
      <div className="bg-background-tertiary rounded-xl p-4 border border-border-secondary">
        <h4 className="text-sm font-medium text-text-secondary mb-4 text-center">
          Evolución proyectada del capital
        </h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datosGrafico} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                {(() => {
                  const g = createGradientDef('colorCapital', areaColor);
                  return (
                    <linearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset={g.topOffset} stopColor={g.color} stopOpacity={g.topOpacity} />
                      <stop offset={g.bottomOffset} stopColor={g.color} stopOpacity={g.bottomOpacity} />
                    </linearGradient>
                  );
                })()}
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis 
                {...axisProps}
                dataKey="mes"
              />
              <YAxis 
                {...axisProps}
                tickFormatter={(value) => formatCompactNumber(value)}
              />
              <Tooltip 
                content={
                  <ChartTooltip 
                    labelFormatter={(label) => `Mes ${label}`}
                    valueFormatter={(value) => formatARS(Number(value))}
                  />
                } 
              />
              <Area 
                type="monotone" 
                dataKey="capital" 
                stroke={lineColor}
                fillOpacity={1} 
                fill="url(#colorCapital)" 
                strokeWidth={2}
                activeDot={{ r: 5, stroke: lineColor, strokeWidth: 2, fill: 'var(--bg-primary)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-background-tertiary border border-border-secondary rounded-lg">
        <Info className="w-4 h-4 text-text-tertiary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-text-tertiary">
          Esta proyección asume que el spread se mantiene constante con capitalización diaria, y no considera inflación ni comisiones.
        </p>
      </div>
    </div>
  );
}

export default CompoundProjection;
