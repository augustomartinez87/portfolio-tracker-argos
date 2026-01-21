import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import { formatARS, formatPercent } from '../../utils/formatters';

export function TopPerformers({ positions, prices, maxItems = 3 }) {
  const { gainers, losers } = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { gainers: [], losers: [] };
    }

    const performanceData = positions.map(pos => {
      const currentPrice = prices[pos.ticker]?.precio || pos.precioActual;
      const performance = pos.precioPromedio > 0 
        ? ((currentPrice - pos.precioPromedio) / pos.precioPromedio) * 100 
        : 0;
      
      return {
        ticker: pos.ticker,
        category: pos.assetClass,
        performance,
        price: currentPrice,
        quantity: pos.cantidadTotal,
        valuacion: pos.valuacionActual
      };
    });

    const sorted = [...performanceData].sort((a, b) => b.performance - a.performance);
    
    return {
      gainers: sorted.filter(p => p.performance > 0).slice(0, maxItems),
      losers: sorted.filter(p => p.performance < 0).reverse().slice(0, maxItems)
    };
  }, [positions, prices, maxItems]);

  return (
    <Card noPadding className="overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-slate-700">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-white">Top Gainers</h3>
            <TrendingUp className="w-3 h-3 text-success" />
          </div>
          <div className="space-y-1.5">
            {gainers.length === 0 ? (
              <p className="text-slate-500 text-[10px] text-center py-1">Sin ganancias</p>
            ) : (
              gainers.map((gainer, index) => (
                <PerformerItem
                  key={gainer.ticker}
                  {...gainer}
                  variant="gainer"
                  rank={index + 1}
                />
              ))
            )}
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-white">Top Laggards</h3>
            <TrendingDown className="w-3 h-3 text-danger" />
          </div>
          <div className="space-y-1.5">
            {losers.length === 0 ? (
              <p className="text-slate-500 text-[10px] text-center py-1">Sin pérdidas</p>
            ) : (
              losers.map((loser, index) => (
                <PerformerItem
                  key={loser.ticker}
                  {...loser}
                  variant="loser"
                  rank={index + 1}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PerformerItem({ 
  ticker, 
  category, 
  performance, 
  variant,
  rank
}) {
  const isGainer = variant === 'gainer';

  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-700/20 hover:bg-slate-700/40 transition-all group">
      <div className={clsx(
        'flex items-center justify-center w-5 h-5 rounded font-mono font-bold text-[10px]',
        isGainer ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
      )}>
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-white font-medium truncate">
            {ticker}
          </span>
        </div>
        <div className={clsx(
          'text-[10px] font-mono font-semibold',
          isGainer ? 'text-success' : 'text-danger'
        )}>
          {isGainer ? '+' : ''}{performance.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
