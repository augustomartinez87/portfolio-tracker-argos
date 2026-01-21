import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { PieChartIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { calculateAssetDistribution, formatCurrency, formatPercentage } from '../utils/portfolioHelpers';

export const DistributionChart = ({ positions }) => {
  const { distribution, totalValue } = useMemo(
    () => calculateAssetDistribution(positions),
    [positions]
  );

  const portfolioChange = useMemo(() => {
    if (!positions || positions.length === 0) return 0;
    const totalResult = positions.reduce((sum, pos) => sum + (pos.resultadoDiario || 0), 0);
    return totalResult;
  }, [positions]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background-dark border border-slate-700 rounded-custom p-3 shadow-2xl">
          <p className="text-white font-semibold text-sm mb-1">{data.name}</p>
          <p className="text-slate-300 text-sm">{formatCurrency(data.value)}</p>
          <p className="text-success font-medium text-sm">{formatPercentage(data.percentage)}</p>
          <p className="text-slate-500 text-xs mt-1">{data.count} posiciones</p>
        </div>
      );
    }
    return null;
  };

  if (distribution.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-custom border border-primary/30">
            <PieChartIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Distribución</h3>
            <p className="text-xs text-slate-500">
              {distribution.length} categorías • {positions.length} activos
            </p>
          </div>
        </div>
        
        {portfolioChange !== 0 && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-custom border ${
            portfolioChange >= 0 
              ? 'bg-success/10 border-success/30' 
              : 'bg-danger/10 border-danger/30'
          }`}>
            {portfolioChange >= 0 ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-danger" />
            )}
            <span className={`text-sm font-mono font-semibold ${
              portfolioChange >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {portfolioChange >= 0 ? '+' : ''}{formatCurrency(portfolioChange)}
            </span>
          </div>
        )}
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
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
                style={{
                  fontSize: '16px',
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
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                padding: '8px'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 mt-2">
        {distribution.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-center py-1.5 px-3 rounded-custom bg-slate-800/50 border border-slate-700/30"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-white font-medium">{item.name}</span>
              <span className="text-xs text-slate-500">({item.count})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-success font-mono font-semibold">
                {formatPercentage(item.percentage)}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {formatCurrency(item.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default DistributionChart;
