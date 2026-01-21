import React, { useMemo } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { cn, formatCurrency, formatPercentage } from '../../utils/cn';
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
      label: 'Total Trades',
      value: metrics.totalTrades.toString(),
      icon: Activity,
      iconColor: 'text-primary',
    },
    {
      label: 'Invertido Total',
      value: formatCurrency(metrics.totalInvertido),
      icon: DollarSign,
      iconColor: 'text-warning',
    },
    {
      label: 'Avg Trade Size',
      value: formatCurrency(metrics.avgTradeSize),
      icon: BarChart3,
      iconColor: 'text-purple-400',
    },
    {
      label: 'Mayor Trade',
      value: formatCurrency(metrics.bestTrade),
      icon: TrendingUp,
      iconColor: 'text-success',
    },
    {
      label: 'Menor Trade',
      value: formatCurrency(metrics.worstTrade),
      icon: TrendingDown,
      iconColor: 'text-danger',
    },
    {
      label: 'Promedio Trade',
      value: formatCurrency(metrics.avgTrade),
      icon: Target,
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Métricas de Trading"
        subtitle="Estadísticas de tu actividad"
      />
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {metricsData.map((metric) => (
          <MetricItem key={metric.label} {...metric} />
        ))}
      </div>
    </Card>
  );
}

function MetricItem({ label, value, icon: Icon, iconColor }) {
  return (
    <div className="p-4 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-all border border-transparent hover:border-slate-600 group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-slate-400">{label}</span>
        <div className={cn('p-1.5 rounded-md bg-slate-800', iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      
      <div className="font-mono text-xl font-bold text-white mb-1">
        {value}
      </div>
    </div>
  );
}
