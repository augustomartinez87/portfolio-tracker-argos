// src/components/DistributionChart.jsx
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { Activity, PieChartIcon, TrendingUp, TrendingDown } from 'lucide-react';
import {
  calculateAssetDistribution,
  formatCurrency,
  formatPercentage
} from '../utils/portfolioHelpers';

export const DistributionChart = ({ positions }) => {
  const { distribution, totalValue } = useMemo(
    () => calculateAssetDistribution(positions),
    [positions]
  );

  // Calculate portfolio change for trend indicator
  const portfolioChange = useMemo(() => {
    if (!positions || positions.length === 0) return 0;
    const totalResult = positions.reduce((sum, pos) => sum + (pos.resultadoDiario || 0), 0);
    return totalResult;
  }, [positions]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-2xl">
          <p className="text-white font-semibold text-sm mb-1">{data.name}</p>
          <p className="text-slate-300 text-sm">{formatCurrency(data.value)}</p>
          <p className="text-emerald-400 font-medium text-sm">{formatPercentage(data.percentage)}</p>
          <p className="text-slate-500 text-xs mt-1">{data.count} posiciones</p>
        </div>
      );
    }
    return null;
  };

  if (distribution.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border border-slate-700/50 text-center">
        <p className="text-slate-400">No hay posiciones para mostrar</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-xl p-6 border border-slate-700/50 shadow-xl backdrop-blur-sm">
      {/* Header con indicador de tendencia */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-lg border border-emerald-500/30">
            <PieChartIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Distribución por Asset Class</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {distribution.length} categorías • {positions.length} activos
            </p>
          </div>
        </div>
        
        {portfolioChange !== 0 && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
            portfolioChange >= 0 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {portfolioChange >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-mono font-semibold ${
              portfolioChange >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {portfolioChange >= 0 ? '+' : ''}{formatCurrency(portfolioChange)}
            </span>
          </div>
        )}
      </div>

      {/* Gráfico mejorado */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl"></div>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              cornerRadius={8}
            >
              {distribution.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeOpacity={0.3}
                />
              ))}
              <Label
                value={formatCurrency(totalValue)}
                position="center"
                className="fill-white"
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  fill: '#ffffff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              />
            </Pie>
            <Tooltip 
              content={<CustomTooltip />} 
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                padding: '12px'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend mejorada */}
      <div className="space-y-3">
        {distribution.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center py-3 px-4 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-all duration-200 border border-slate-700/30 hover:border-slate-600/50 group"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-lg shadow-sm transform group-hover:scale-110 transition-transform"
                style={{ 
                  backgroundColor: item.color,
                  boxShadow: `0 2px 4px ${item.color}40`
                }}
              />
              <div>
                <span className="text-sm font-medium text-white">{item.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">{item.count} activo{item.count !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-slate-600">•</span>
                  <span className="text-xs font-mono text-slate-400">{formatPercentage(item.percentage)}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-white font-mono block">
                {formatCurrency(item.value)}
              </span>
              <span className="text-xs text-slate-500">
                {((item.value / totalValue) * 100).toFixed(1)}% del total
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DistributionChart;
