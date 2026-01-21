import React from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatRelativeDate } from '../../utils/cn';
import { ArrowDownCircle, ArrowUpCircle, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';
import { formatNumber } from '../../utils/formatters';

export function RecentActivity({ trades, maxItems = 10 }) {
  const sortedTrades = [...trades]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, maxItems);

  return (
    <Card className="h-full">
      <CardHeader
        title="Actividad Reciente"
        subtitle="Últimas operaciones"
        action={
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="w-4 h-4" />
            <span>Últimas {maxItems}</span>
          </div>
        }
      />
      
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {sortedTrades.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Sin operaciones registradas</p>
        ) : (
          sortedTrades.map((trade) => (
            <TradeItem key={trade.id} trade={trade} />
          ))
        )}
      </div>
    </Card>
  );
}

function TradeItem({ trade }) {
  const isBuy = true;
  
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-all group border border-transparent hover:border-slate-600">
      <div className={cn(
        'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
        isBuy ? 'bg-success/10' : 'bg-danger/10'
      )}>
        <ArrowUpCircle className="w-5 h-5 text-success" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            'text-sm font-semibold',
            isBuy ? 'text-success' : 'text-danger'
          )}>
            Compra
          </span>
          <span className="text-sm text-slate-500">•</span>
          <span className="font-mono font-semibold text-white">
            {trade.ticker}
          </span>
          <Badge variant="default">
            {trade.assetClass || getAssetClass(trade.ticker)}
          </Badge>
        </div>
        
        <div className="text-sm text-slate-300">
          <span className="font-mono">{formatNumber(trade.cantidad)}</span>
          <span className="text-slate-500"> acciones @ </span>
          <span className="font-mono">{formatCurrency(trade.precioCompra)}</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="font-mono font-semibold text-sm text-white mb-1">
          {formatCurrency(trade.cantidad * trade.precioCompra)}
        </div>
        <div className="text-xs text-slate-500 font-mono">
          {formatRelativeDate(trade.fecha)}
        </div>
      </div>
    </div>
  );
}

function getAssetClass(ticker) {
  if (/^(AL30|GD30|AE38|AL29|GD29)$/.test(ticker)) return 'BONOS HD';
  if (/^(TTD26|T15E7|TX26|TX28|S31E5)$/.test(ticker)) return 'BONOS PESOS';
  if (/^[A-Z]{1,5}$/.test(ticker) && ticker.length <= 4) return 'ARGY';
  return 'CEDEAR';
}
