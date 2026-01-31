import React, { useMemo } from 'react';
import Decimal from 'decimal.js';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { formatARS, formatNumber } from '@/utils/formatters';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

/**
 * Proyección de Interés Compuesto para Carry Trade
 * Muestra cómo crecería el capital con reinversión mensual de ganancias
 * 
 * @param {Object} props
 * @param {number} props.capitalProductivo - Capital inicial para proyección
 * @param {number} props.bufferTasa - Spread TNA como decimal (ej: 0.0027 para 0.27%)
 */
export function CompoundProjection({ capitalProductivo, bufferTasa }) {
  // Cálculos de proyección usando Decimal.js para precisión
  const proyecciones = useMemo(() => {
    const capitalInicial = new Decimal(capitalProductivo || 0);
    const spreadDecimal = new Decimal(bufferTasa || 0);
    
    if (capitalInicial.isZero() || spreadDecimal.isZero()) {
      return null;
    }

    // Tasa mensual = spread anual / 12
    const tasaMensual = spreadDecimal.dividedBy(12);
    
    // Función para calcular proyección a N meses: C * (1 + r)^n
    const calcularProyeccion = (meses) => {
      const mesesDec = new Decimal(meses);
      // (1 + tasaMensual) ^ meses
      const factor = new Decimal(1).plus(tasaMensual).pow(mesesDec.toNumber());
      const capitalFinal = capitalInicial.times(factor);
      const ganancia = capitalFinal.minus(capitalInicial);
      const porcentajeGanancia = ganancia.dividedBy(capitalInicial).times(100);
      
      return {
        capitalFinal: capitalFinal.toNumber(),
        ganancia: ganancia.toNumber(),
        porcentajeGanancia: porcentajeGanancia.toNumber(),
      };
    };

    // Calcular proyecciones para 3, 6 y 12 meses
    const proyeccion3m = calcularProyeccion(3);
    const proyeccion6m = calcularProyeccion(6);
    const proyeccion12m = calcularProyeccion(12);

    // Generar datos para el gráfico (meses 0-12)
    const datosGrafico = [];
    for (let mes = 0; mes <= 12; mes++) {
      const factor = new Decimal(1).plus(tasaMensual).pow(mes);
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

  // Función auxiliar para formatear números grandes en formato compacto
  function formatCompactNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  }

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

  // Custom tooltip para el gráfico
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background-secondary border border-border-primary rounded-lg p-3 shadow-lg">
          <p className="text-sm text-text-tertiary mb-1">Mes {label}</p>
          <p className="text-lg font-mono font-semibold text-text-primary">
            {formatARS(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
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
  const lineColor = isPositiveGrowth ? '#22c55e' : '#ef4444'; // success o danger
  const areaColor = isPositiveGrowth ? '#22c55e' : '#ef4444';

  return (
    <div className="space-y-6">
      {/* Subtítulo */}
      <p className="text-sm text-text-secondary">
        Asumiendo reinversión mensual de ganancias al spread actual ({formatNumber(bufferTasa * 100, 2)}%)
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
                <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={areaColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={areaColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
              <XAxis 
                dataKey="mes" 
                stroke="var(--text-tertiary)"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
                label={{ value: 'Meses', position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)' }}
              />
              <YAxis 
                stroke="var(--text-tertiary)"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
                tickFormatter={(value) => formatCompactNumber(value)}
                label={{ value: 'Capital', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="capital" 
                stroke={lineColor}
                fillOpacity={1} 
                fill="url(#colorCapital)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-background-tertiary border border-border-secondary rounded-lg">
        <Info className="w-4 h-4 text-text-tertiary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-text-tertiary">
          Esta proyección asume que el spread se mantiene constante, las ganancias se reinvierten mensualmente, y no considera inflación.
        </p>
      </div>
    </div>
  );
}

export default CompoundProjection;
