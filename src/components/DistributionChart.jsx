import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { PieChartIcon, TrendingUp, TrendingDown, X } from 'lucide-react';
import { calculateAssetDistribution, formatCurrency, formatPercentage } from '../utils/portfolioHelpers';

export const DistributionChart = ({ positions }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const { distribution, totalValue } = useMemo(
    () => calculateAssetDistribution(positions),
    [positions]
  );

  const portfolioChange = useMemo(() => {
    if (!positions || positions.length === 0) return 0;
    const totalResult = positions.reduce((sum, pos) => sum + (pos.resultadoDiario || 0), 0);
    return totalResult;
  }, [positions]);

  const categoryAssets = useMemo(() => {
    if (!selectedCategory) return [];
    return positions
      .filter(p => p.assetClass === selectedCategory)
      .map(p => ({
        ...p,
        percentage: totalValue > 0 ? (p.valuacionActual / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.valuacionActual - a.valuacionActual);
  }, [positions, selectedCategory, totalValue]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
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
    <div className="h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/20 rounded">
            <PieChartIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Distribución</h3>
          </div>
        </div>
        
        {portfolioChange !== 0 && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded border ${
            portfolioChange >= 0 
              ? 'bg-success/10 border-success/30' 
              : 'bg-danger/10 border-danger/30'
          }`}>
            {portfolioChange >= 0 ? (
              <TrendingUp className="w-3 h-3 text-success" />
            ) : (
              <TrendingDown className="w-3 h-3 text-danger" />
            )}
            <span className={`text-xs font-mono font-semibold ${
              portfolioChange >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {portfolioChange >= 0 ? '+' : ''}{formatCurrency(portfolioChange)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center py-2">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(_, index) => setSelectedCategory(selectedCategory === distribution[index]?.name ? null : distribution[index]?.name)}
              cursor="pointer"
            >
              {distribution.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={hoveredIndex === index ? 3 : 1}
                  strokeOpacity={0.5}
                  style={{
                    transform: hoveredIndex === index ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease-out, stroke-width 0.2s ease-out',
                    filter: hoveredIndex === index ? `drop-shadow(0 0 6px ${entry.color}80)` : 'none'
                  }}
                />
              ))}
              <Label
                value={formatCurrency(totalValue)}
                position="center"
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fill: '#ffffff',
                }}
              />
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1 mt-2">
        {distribution.map((item, index) => (
          <button
            key={index}
            onClick={() => setSelectedCategory(selectedCategory === item.name ? null : item.name)}
            className={`w-full flex justify-between items-center py-1.5 px-2 rounded border transition-all ${
              selectedCategory === item.name 
                ? 'bg-slate-700/50 border-primary/40' 
                : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-white font-medium">{item.name}</span>
              <span className="text-xs text-slate-500">({item.count})</span>
            </div>
            <span className="text-xs text-success font-mono font-semibold">
              {formatPercentage(item.percentage)}
            </span>
          </button>
        ))}
      </div>

      {selectedCategory && categoryAssets.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white">
              {selectedCategory} <span className="text-slate-400 font-normal">({categoryAssets.length})</span>
            </p>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
            {categoryAssets.map((asset, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-1 px-1.5 rounded bg-slate-800/20"
              >
                <span className="text-xs font-mono text-white">{asset.ticker}</span>
                <span className="text-xs text-primary font-mono">{formatPercentage(asset.percentage)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionChart;
