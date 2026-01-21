import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChartIcon, X } from 'lucide-react';
import { calculateAssetDistribution, formatCurrency, formatPercentage } from '../utils/portfolioHelpers';

export const DistributionChart = ({ positions }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const { distribution, totalValue } = useMemo(
    () => calculateAssetDistribution(positions),
    [positions]
  );

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
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-xl">
          <p className="text-white font-semibold text-xs mb-1">{data.name}</p>
          <p className="text-slate-300 text-xs">{formatCurrency(data.value)}</p>
          <p className="text-success text-xs">{formatPercentage(data.percentage)}</p>
        </div>
      );
    }
    return null;
  };

  if (distribution.length === 0) {
    return null;
  }

  return (
    <div className="relative h-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 bg-primary/20 rounded">
          <PieChartIcon className="w-4 h-4 text-emerald-400" />
        </div>
        <h3 className="text-sm font-bold text-white">Distribución</h3>
      </div>

      <div className="flex items-center justify-center py-2 relative">
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
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
                  strokeWidth={hoveredIndex === index ? 2 : 0}
                  style={{
                    transform: hoveredIndex === index ? 'scale(1.08)' : 'scale(1)',
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease-out',
                    filter: hoveredIndex === index ? `drop-shadow(0 0 8px ${entry.color}60)` : 'none'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-xs font-bold text-white font-mono">{formatCurrency(totalValue).replace('ARS', '')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1">
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
            </div>
            <span className="text-xs text-success font-mono font-semibold">
              {formatPercentage(item.percentage)}
            </span>
          </button>
        ))}
      </div>

      {selectedCategory && categoryAssets.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 z-10">
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
                className="flex justify-between items-center py-1 px-1.5 rounded bg-slate-700/20"
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
