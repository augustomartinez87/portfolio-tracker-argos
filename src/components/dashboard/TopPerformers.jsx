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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader
          title="Top Gainers"
          subtitle="Mejores performers"
          action={
            <div className="p-2 bg-success/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
          }
        />
        <div className="space-y-3">
          {gainers.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Sin ganancias aún</p>
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
        <CardHeader
          title="Top Laggards"
          subtitle="Peores performers"
          action={
            <div className="p-2 bg-danger/10 rounded-lg">
              <TrendingDown className="w-5 h-5 text-danger" />
            </div>
          }
        />
        <div className="space-y-3">
          {losers.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Sin pérdidas aún</p>
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
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-all group">
      <div className={clsx(
        'flex items-center justify-center w-8 h-8 rounded-lg font-mono font-bold text-sm',
        isGainer ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
      )}>
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-white">
            {ticker}
          </span>
          <span className="text-xs text-slate-500">
            {category}
          </span>
        </div>
        <div className={clsx(
          'text-sm font-mono font-semibold mt-0.5',
          isGainer ? 'text-success' : 'text-danger'
        )}>
          {isGainer ? '+' : ''}{performance.toFixed(2)}%
        </div>
      </div>

      <div className="w-16 h-8">
        <Sparkline
          data={sparklineData}
          color={isGainer ? '#10B981' : '#EF4444'}
        />
      </div>
    </div>
  );
}
