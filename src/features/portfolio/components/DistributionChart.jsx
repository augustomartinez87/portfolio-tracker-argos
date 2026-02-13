import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChartIcon, X } from 'lucide-react';
import { calculateAssetDistribution } from '@/utils/portfolioHelpers';
import { PercentageDisplay } from '@/components/common/PercentageDisplay';
import { formatARS, formatUSD, formatPercent } from '@/utils/formatters';

export const DistributionChart = ({ positions, currency = 'ARS' }) => {
  const formatCurrency = (val) => currency === 'ARS' ? formatARS(val) : formatUSD(val);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const { distribution, totalValue } = useMemo(
    () => calculateAssetDistribution(positions, currency),
    [positions, currency]
  );

  const categoryAssets = useMemo(() => {
    if (!selectedCategory) return [];
    return positions
      .filter(p => p.assetClass === selectedCategory)
      .map(p => {
        const val = currency === 'ARS' ? p.valuation : p.valuationUSD;
        return {
          ...p,
          displayVal: val,
          percentage: totalValue > 0 ? (val / totalValue) * 100 : 0
        };
      })
      .sort((a, b) => b.displayVal - a.displayVal);
  }, [positions, selectedCategory, totalValue, currency]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background-secondary border border-border-primary rounded-lg p-2 shadow-xl">
          <p className="text-text-primary font-semibold text-xs mb-1">{data.name}</p>
          <div className="space-y-0.5">
            <p className="text-text-secondary text-xs">{formatCurrency(data.value)}</p>
            <div className="flex items-center gap-2">
              <span className="text-text-tertiary text-[10px] uppercase">Peso:</span>
              <PercentageDisplay value={data.percentage} iconSize="w-3 h-3" className="text-xs" showArrow={false} neutral={true} />
            </div>
            {data.pnlPct !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-text-tertiary text-[10px] uppercase">P&L:</span>
                <PercentageDisplay value={data.pnlPct} iconSize="w-3 h-3" className="text-xs font-bold" />
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (distribution.length === 0) {
    return null;
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <div className="p-1.5 bg-primary/20 rounded">
          <PieChartIcon className="w-4 h-4 text-success" />
        </div>
        <h3 className="text-sm font-bold text-text-primary">Distribución por Activos</h3>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-[200px] relative">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(_, index) => setSelectedCategory(selectedCategory === distribution[index]?.name ? null : distribution[index]?.name)}
              cursor="pointer"
            >
              {distribution.map((entry, index) => (
                <Cell
                  key={`cell - ${index} `}
                  fill={entry.color}
                  stroke="var(--border-primary)"
                  strokeWidth={2}
                  style={{
                    transform: hoveredIndex === index ? 'scale(1.08)' : 'scale(1)',
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease-out',
                    filter: hoveredIndex === index ? `drop - shadow(0 0 10px ${entry.color}80)` : 'none'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-text-tertiary">Total</p>
            <p className="text-base font-bold text-text-primary font-mono whitespace-nowrap">
              {currency === 'ARS' ? formatARS(totalValue).replace('ARS', '').trim() : formatUSD(totalValue).replace('US$', '').trim()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 mt-2">
        {distribution.map((item, index) => (
          <button
            key={index}
            onClick={() => setSelectedCategory(selectedCategory === item.name ? null : item.name)}
            className={`w - full flex justify - between items - center py - 1.5 px - 3 rounded border transition - all ${selectedCategory === item.name
              ? 'bg-background-tertiary border-primary/40'
              : 'bg-background-secondary/30 border-border-primary/10 hover:bg-background-tertiary'
              } `}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-sm text-text-primary font-medium">{item.name}</span>
                {item.pnlPct !== undefined && (
                  <span className={`text - [10px] font - bold ${item.pnlPct >= 0 ? 'text-profit' : 'text-loss'} `}>
                    {item.pnlPct >= 0 ? '+' : ''}{item.pnlPct.toFixed(1)}% P&L
                  </span>
                )}
              </div>
            </div>
            <PercentageDisplay value={item.percentage} iconSize="w-3 h-3" className="text-sm font-mono font-semibold text-text-primary" showArrow={false} neutral={true} />
          </button>
        ))}
      </div>

      {selectedCategory && categoryAssets.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 bg-background-secondary border border-border-primary rounded-lg shadow-xl p-3 z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary">
              {selectedCategory} <span className="text-text-tertiary font-normal">({categoryAssets.length})</span>
            </p>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-text-tertiary hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
            {categoryAssets.map((asset, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-1.5 px-2 rounded bg-background-tertiary"
              >
                <span className="text-sm font-mono text-text-primary">{asset.ticker}</span>
                <PercentageDisplay value={asset.percentage} iconSize="w-3 h-3" className="text-sm font-mono text-text-primary" showArrow={false} neutral={true} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionChart;
