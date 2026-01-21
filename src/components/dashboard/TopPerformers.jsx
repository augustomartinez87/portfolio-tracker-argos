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
        valuacion: pos.valuacionActual,
        avgPrice: pos.precioPromedio
      };
    });

    const sorted = [...performanceData].sort((a, b) => b.performance - a.performance);

    return {
      gainers: sorted.filter(p => p.performance > 0).slice(0, maxItems),
      losers: sorted.filter(p => p.performance < 0).reverse().slice(0, maxItems)
    };
  }, [positions, prices, maxItems]);

  return (
    <Card noPadding className="overflow-hidden !max-h-[380px]">
      <div className="grid grid-cols-2 divide-x divide-slate-700 h-full">
        <div className="p-3 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h3 className="text-sm font-bold text-white">Top Gainers</h3>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {gainers.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-2">Sin ganancias</p>
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

        <div className="p-3 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h3 className="text-sm font-bold text-white">Top Laggards</h3>
            <TrendingDown className="w-4 h-4 text-danger" />
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {losers.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-2">Sin pérdidas</p>
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
  rank,
  price,
  quantity,
  avgPrice
}) {
  const isGainer = variant === 'gainer';
  const valuacion = price * quantity;
  const costo = avgPrice * quantity;
  const pnl = valuacion - costo;

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-slate-700/20 hover:bg-slate-700/40 transition-all group">
      <div className={clsx(
        'flex items-center justify-center w-6 h-6 rounded font-mono font-bold text-xs flex-shrink-0',
        isGainer ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
      )}>
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm text-white font-semibold truncate">
            {ticker}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <div className={clsx(
          'text-sm font-mono font-bold',
          isGainer ? 'text-success' : 'text-danger'
        )}>
          {isGainer ? '+' : ''}{performance.toFixed(2)}%
        </div>
        <div className={clsx(
          'text-xs font-mono font-semibold',
          isGainer ? 'text-success' : 'text-danger'
        )}>
          {isGainer ? '+' : ''}{formatARS(pnl)}
        </div>
      </div>
    </div>
  );
}
