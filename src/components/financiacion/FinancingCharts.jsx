import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, Clock, DollarSign } from 'lucide-react';

const FinancingCharts = ({ cauciones, csvData, loading }) => {
  // Procesamiento de datos para visualizaciones
  const chartData = useMemo(() => {
    const data = csvData && csvData.operaciones ? csvData.operaciones : cauciones || [];
    
    if (data.length === 0) {
      return {
        tenorDistribution: [],
        rateDistribution: [],
        monthlyTrends: [],
        capitalFlow: []
      };
    }

    // Distribución por tenor (plazos)
    const tenorBuckets = {
      '1-7 días': { count: 0, capital: 0 },
      '8-15 días': { count: 0, capital: 0 },
      '16-30 días': { count: 0, capital: 0 },
      '31+ días': { count: 0, capital: 0 }
    };

    // Distribución de tasas
    const rateBuckets = {
      '0-50%': { count: 0, capital: 0 },
      '50-100%': { count: 0, capital: 0 },
      '100-150%': { count: 0, capital: 0 },
      '150%+': { count: 0, capital: 0 }
    };

    // Datos de ejemplo para visualización (reemplazar con cálculos reales)
    data.forEach(op => {
      const days = op.dias || 0;
      const rate = op.tasa_tna || 0;
      const capital = op.capital || 0;

      // Agrupar por tenor
      if (days <= 7) tenorBuckets['1-7 días'].count += 1;
      else if (days <= 15) tenorBuckets['8-15 días'].count += 1;
      else if (days <= 30) tenorBuckets['16-30 días'].count += 1;
      else tenorBuckets['31+ días'].count += 1;

      // Agrupar por tasa
      if (rate <= 50) rateBuckets['0-50%'].count += 1;
      else if (rate <= 100) rateBuckets['50-100%'].count += 1;
      else if (rate <= 150) rateBuckets['100-150%'].count += 1;
      else rateBuckets['150%+'].count += 1;
    });

      const totalOps = data.length;
      return {
        tenorDistribution: Object.entries(tenorBuckets).map(([label, data]) => ({
          label,
          count: data.count,
          percentage: totalOps > 0 ? (data.count / totalOps * 100).toFixed(1) : 0
        })),
        rateDistribution: Object.entries(rateBuckets).map(([label, data]) => ({
          label,
          count: data.count,
          percentage: totalOps > 0 ? (data.count / totalOps * 100).toFixed(1) : 0
        })),
        monthlyTrends: [],
        capitalFlow: []
      };
  }, [cauciones, csvData]);

  if (loading) {
    return (
      <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-background-tertiary rounded w-1/3 mb-3"></div>
              <div className="h-32 bg-background-tertiary rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cauciones.length === 0 && !csvData) {
    return (
      <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">Sin Datos para Analizar</h3>
          <p className="text-text-tertiary">
            Sube un archivo CSV o procesa operaciones para ver los gráficos y análisis
          </p>
        </div>
      </div>
    );
  }

  const SimpleBarChart = ({ title, data, icon: Icon, colorClass }) => {
    const maxValue = Math.max(...data.map(d => d.count));

    return (
      <div className="bg-background-tertiary rounded-lg p-4 border border-border-primary">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-text-tertiary" />
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        </div>
        
        <div className="space-y-2">
          {data.map((item, index) => {
            const percentage = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
            return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-tertiary">{item.label}</span>
                  <span className="text-text-primary">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-6 bg-background-secondary rounded-sm overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Análisis Visual</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleBarChart
          title="Distribución por Plazo"
          data={chartData.tenorDistribution}
          icon={Clock}
          colorClass="bg-blue-500"
        />
        
        <SimpleBarChart
          title="Distribución por Tasa"
          data={chartData.rateDistribution}
          icon={TrendingUp}
          colorClass="bg-green-500"
        />
      </div>

      {/* Resumen de Métricas */}
      <div className="bg-background-tertiary rounded-lg p-4 border border-border-primary">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-text-tertiary" />
          <h3 className="text-sm font-medium text-text-primary">Resumen de Operaciones</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-text-tertiary">Operaciones Cortas (&lt;=7d)</p>
            <p className="text-sm font-medium text-text-primary">
              {chartData.tenorDistribution.find(d => d.label === '1-7 días')?.count || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Operaciones Largas (&gt;30d)</p>
            <p className="text-sm font-medium text-text-primary">
              {chartData.tenorDistribution.find(d => d.label === '31+ días')?.count || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Tasas Altas (&gt;150%)</p>
            <p className="text-sm font-medium text-text-primary">
              {chartData.rateDistribution.find(d => d.label === '150%+')?.count || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Tasas Bajas (≤50%)</p>
            <p className="text-sm font-medium text-text-primary">
              {chartData.rateDistribution.find(d => d.label === '0-50%')?.count || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder para futuros gráficos */}
      <div className="bg-background-tertiary rounded-lg p-4 border border-border-primary">
        <h3 className="text-sm font-medium text-text-primary mb-2">Próximamente</h3>
        <div className="text-xs text-text-tertiary space-y-1">
          <p>• Evolución histórica de tasas</p>
          <p>• Proyecciones y escenarios</p>
          <p>• Comparación con benchmarks (BADLAR, tasas de política)</p>
          <p>• Análisis de correlación con mercado</p>
        </div>
      </div>
    </div>
  );
};

export default FinancingCharts;