import React, { useMemo } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Sparkline } from '../charts/Sparkline';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

export function TopPerformers({ positions, prices, maxItems = 5 }) {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Top Gainers</h3>
          <TrendingUp className="w-4 h-4 text-success" />
        </div>
        <div className="space-y-2">
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
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Top Laggards</h3>
          <TrendingDown className="w-4 h-4 text-danger" />
        </div>
        <div className="space-y-2">
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
      </Card>
    </div>
  );
}

function PerformerItem({ 
  ticker, 
  category, 
  performance, 
  variant,
  rank,
  price
}) {
  const isGainer = variant === 'gainer';
  const sparklineData = useMemo(() => {
    const baseValue = price / (1 + performance / 100);
    const data = [];
    for (let i = 0; i < 7; i++) {
      const progress = i / 6;
      const randomVariation = (Math.random() - 0.5) * (baseValue * 0.02);
      data.push(baseValue + (price - baseValue) * progress + randomVariation);
    }
    return data;
  }, [price, performance]);

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-slate-700/20 hover:bg-slate-700/40 transition-all group">
      <div className={clsx(
        'flex items-center justify-center w-6 h-6 rounded font-mono font-bold text-xs',
        isGainer ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
      )}>
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-white font-medium">
            {ticker}
          </span>
        </div>
        <div className={clsx(
          'text-xs font-mono font-semibold',
          isGainer ? 'text-success' : 'text-danger'
        )}>
          {isGainer ? '+' : ''}{performance.toFixed(2)}%
        </div>
      </div>

      <div className="w-12 h-6">
        <Sparkline
          data={sparklineData}
          color={isGainer ? '#10B981' : '#EF4444'}
        />
      </div>
    </div>
  );
}
