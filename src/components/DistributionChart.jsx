import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { PieChartIcon, TrendingUp, TrendingDown, X } from 'lucide-react';
import { calculateAssetDistribution, formatCurrency, formatPercentage } from '../utils/portfolioHelpers';

export const DistributionChart = ({ positions }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

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

  const handlePieClick = (data) => {
    if (data && data.name) {
      setSelectedCategory(selectedCategory === data.name ? null : data.name);
    }
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 15;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

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
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
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
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
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
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              cornerRadius={6}
              onClick={handlePieClick}
              cursor="pointer"
              activeIndex={distribution.findIndex(d => d.name === selectedCategory)}
              activeShape={{
                outerRadius: 100,
                stroke: '#fff',
                strokeWidth: 3,
                fill: distribution.find(d => d.name === selectedCategory)?.color,
                filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))'
              }}
            >
              {distribution.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeOpacity={0.3}
                  className="transition-all duration-300"
                />
              ))}
              <Label
                value={formatCurrency(totalValue)}
                position="center"
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  fill: '#ffffff',
                }}
              />
            </Pie>
            <Tooltip 
              content={<CustomTooltip />} 
              contentStyle={{
                backgroundColor: '#0f172a',
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
          <button
            key={index}
            onClick={() => setSelectedCategory(selectedCategory === item.name ? null : item.name)}
            className={`w-full flex justify-between items-center py-2 px-3 rounded-lg border transition-all duration-300 ${
              selectedCategory === item.name 
                ? 'bg-slate-700/50 border-primary/50 shadow-lg' 
                : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full transition-transform duration-300"
                style={{ 
                  backgroundColor: item.color,
                  transform: selectedCategory === item.name ? 'scale(1.2)' : 'scale(1)'
                }}
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
          </button>
        ))}
      </div>

      {selectedCategory && categoryAssets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">
              {selectedCategory} <span className="text-slate-400 font-normal">({categoryAssets.length} activos)</span>
            </p>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {categoryAssets.map((asset, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-800/30 border border-slate-700/20"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white">{asset.ticker}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{formatCurrency(asset.valuacionActual)}</span>
                  <span className="text-xs text-primary font-mono w-12 text-right">{formatPercentage(asset.percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default DistributionChart;
