// src/components/DistributionChart.jsx
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { Activity } from 'lucide-react';
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
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-emerald-400" />
        Distribución por Asset Class
      </h3>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={distribution}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            dataKey="value"
          >
            {distribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <Label
              value={formatCurrency(totalValue)}
              position="center"
              className="fill-white"
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                fill: '#ffffff'
              }}
            />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend manual con Tailwind */}
      <div className="mt-4 space-y-2">
        {distribution.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-300">{item.name}</span>
              <span className="text-xs text-slate-500">({item.count})</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 font-mono">{formatCurrency(item.value)}</span>
              <span className="text-sm font-semibold text-white font-mono min-w-[50px] text-right">
                {formatPercentage(item.percentage)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DistributionChart;
