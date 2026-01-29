import React, { memo, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  BarChart3,
  Activity,
  Target,
  Calculator
} from 'lucide-react';
import { formatARS, formatUSD, formatPercent } from '@/utils/formatters';

const MetricCard = memo(({ title, value, icon: Icon, loading, trend, tooltip }) => {
  if (loading) {
    return (
      <div className="bg-background-secondary rounded-lg p-4 border border-border-primary">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-background-tertiary rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-3 bg-background-tertiary rounded w-20 mb-2 animate-pulse" />
            <div className="h-6 bg-background-tertiary rounded w-32 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-background-secondary rounded-lg p-4 border border-border-primary hover:border-border-secondary transition-colors group"
      title={tooltip}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
          <Icon className="w-5 h-5 text-text-tertiary" />
        </div>
        <div className="flex-1">
          <p className="text-text-tertiary text-xs font-medium">{title}</p>
          <p className="text-text-primary text-xl font-semibold font-mono mt-0.5">
            {value}
          </p>
          {trend !== undefined && (
            <p className={`text-xs font-medium mt-1 ${trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-tertiary'
              }`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

const FinancingKPIs = ({ metrics, csvData, operations, loading }) => {
  // Agregar logging para debugging
  console.log('FinancingKPIs render - csvData:', csvData, 'operations:', operations, 'metrics:', metrics);

  // Calcula KPIs avanzados usando datos del CSV y métricas existentes
  const kpiData = useMemo(() => {
    console.log('FinancingKPIs useMemo recalculando...');
    console.log('FinancingKPIs - csvData en useMemo:', csvData);
    console.log('FinancingKPIs - metrics en useMemo:', metrics);

    // Si hay datos CSV (prioridad alta - datos del upload)
    if (csvData && csvData.summary) {
      console.log('FinancingKPIs - Usando datos CSV');
      const result = {
        capitalTotal: csvData.summary.totalCapital || 0,
        costoTotal: csvData.summary.totalInteres || 0,
        tnaPromedio: csvData.summary.tnaPromedioPonderado || 0,
        duracionPromedio: csvData.summary.diasPromedio || 0,
        desviacionTasa: csvData.summary.desviacionTasa || 0,
        eficiencia: csvData.summary.eficiencia || 0,
        spreadBADLAR: csvData.summary.spreadBADLAR || 0,
        operaciones: csvData.summary.totalRecords || 0,
      };
      console.log('FinancingKPIs - Resultado desde CSV:', result);
      return result;
    }

    // Si hay métricas de la base de datos (fallback)
    if (metrics) {
      console.log('FinancingKPIs - Usando métricas de DB');
      const result = {
        capitalTotal: metrics.capitalTotal || 0,
        costoTotal: metrics.interesTotal || 0,
        tnaPromedio: metrics.tnaPromedioPonderada || 0,
        duracionPromedio: metrics.diasPromedio || 0,
        desviacionTasa: metrics.desviacionTasa || 0,
        eficiencia: metrics.eficiencia || 0,
        spreadBADLAR: metrics.spreadBADLAR || 0,
        operaciones: metrics.totalOperaciones || 0,
      };
      console.log('FinancingKPIs - Resultado desde DB:', result);
      return result;
    }

    // Valores por defecto
    console.log('FinancingKPIs - Usando valores por defecto');
    const defaultResult = {
      capitalTotal: 0,
      costoTotal: 0,
      tnaPromedio: 0,
      duracionPromedio: 0,
      desviacionTasa: 0,
      eficiencia: 0,
      spreadBADLAR: 0,
      operaciones: 0,
    };
    console.log('FinancingKPIs - Resultado por defecto:', defaultResult);
    return defaultResult;
  }, [csvData, metrics, operations]); // Agregar operations a las dependencias
  console.log('FinancingKPIs kpiData calculado:', kpiData);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <MetricCard
        title="Capital Total Operado"
        value={formatARS(kpiData.capitalTotal)}
        icon={DollarSign}
        loading={loading}
        tooltip="Monto total de capital utilizado en operaciones de caución"
      />
      <MetricCard
        title="Costo Total Fondos"
        value={formatARS(kpiData.costoTotal)}
        icon={Calculator}
        loading={loading}
        tooltip="Intereses totales pagados por las operaciones de caución"
      />
      <MetricCard
        title="Tasa Promedio Ponderada"
        value={formatPercent(kpiData.tnaPromedio, 2)}
        icon={Percent}
        loading={loading}
        tooltip="Tasa promedio ponderada por monto de capital"
      />
      <MetricCard
        title="Duración Promedio"
        value={`${kpiData.duracionPromedio.toFixed(0)} días`}
        icon={Clock}
        loading={loading}
        tooltip="Plazo promedio de las operaciones de caución"
      />
      <MetricCard
        title="Spread vs BADLAR"
        value={formatPercent(kpiData.spreadBADLAR, 2)}
        icon={TrendingUp}
        loading={loading}
        tooltip="Diferencia entre tasa de caución y BADLAR"
        trend={kpiData.spreadBADLAR > 0 ? kpiData.spreadBADLAR : -Math.abs(kpiData.spreadBADLAR)}
      />
      <MetricCard
        title="Volatilidad de Tasas"
        value={formatPercent(kpiData.desviacionTasa, 2)}
        icon={Activity}
        loading={loading}
        tooltip="Desviación estándar de las tasas de interés"
      />
      <MetricCard
        title="Eficiencia de Fondeo"
        value={`${kpiData.eficiencia.toFixed(0)}%`}
        icon={Target}
        loading={loading}
        tooltip="Score de eficiencia en la gestión de fondeo (0-100)"
        trend={kpiData.eficiencia - 80}
      />
      <MetricCard
        title="Total Operaciones"
        value={kpiData.operaciones.toLocaleString('es-AR')}
        icon={BarChart3}
        loading={loading}
        tooltip="Número total de operaciones procesadas"
      />
    </div>
  );
};

export default FinancingKPIs;