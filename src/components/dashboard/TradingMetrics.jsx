import React, { useMemo } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { formatCurrency } from '../../utils/cn';
import { clsx } from 'clsx';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  BarChart3,
  DollarSign,
  Activity 
} from 'lucide-react';

export function TradingMetrics({ trades }) {
  const metrics = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        totalInvertido: 0,
        avgTradeSize: 0,
        bestTrade: 0,
        worstTrade: 0,
        avgTrade: 0
      };
    }

    const totalTrades = trades.length;
    const totals = trades.reduce((sum, t) => sum + (t.cantidad * t.precioCompra), 0);
    const avgTradeSize = totals / totalTrades;
    
    const tradeValues = trades.map(t => t.cantidad * t.precioCompra);
    const bestTrade = Math.max(...tradeValues);
    const worstTrade = Math.min(...tradeValues);
    const avgTrade = totals / totalTrades;

    return {
      totalTrades,
      totalInvertido: totals,
      avgTradeSize,
      bestTrade,
      worstTrade,
      avgTrade
    };
  }, [trades]);

  const metricsData = [
    {
      label: 'Trades',
      value: metrics.totalTrades.toString(),
      icon: Activity,
      iconColor: 'text-primary',
    },
    {
      label: 'Invertido',
      value: formatCurrency(metrics.totalInvertido),
      icon: DollarSign,
      iconColor: 'text-warning',
    },
    {
      label: 'Avg Trade',
      value: formatCurrency(metrics.avgTradeSize),
      icon: BarChart3,
      iconColor: 'text-purple-400',
    },
    {
      label: 'Mayor',
      value: formatCurrency(metrics.bestTrade),
      icon: TrendingUp,
      iconColor: 'text-success',
    },
    {
      label: 'Menor',
      value: formatCurrency(metrics.worstTrade),
      icon: TrendingDown,
      iconColor: 'text-danger',
    },
    {
      label: 'Promedio',
      value: formatCurrency(metrics.avgTrade),
      icon: Target,
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Métricas</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {metricsData.map((metric) => (
          <MetricItem key={metric.label} {...metric} />
        ))}
      </div>
    </Card>
  );
}

function MetricItem({ label, value, icon: Icon, iconColor }) {
  return (
    <div className="p-2 rounded bg-slate-700/20 hover:bg-slate-700/40 transition-all">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className={clsx('w-3 h-3', iconColor)} />
      </div>
      
      <div className="font-mono text-base font-bold text-white">
        {value}
      </div>
    </div>
  );
}
