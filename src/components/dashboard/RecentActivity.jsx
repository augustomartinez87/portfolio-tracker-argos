import React from 'react';
import { Card } from '../ui/Card';
import { formatCurrency, formatRelativeDate } from '../../utils/cn';
import { ArrowUpCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { formatNumber } from '../../utils/formatters';

export function RecentActivity({ trades, maxItems = 5 }) {
  const sortedTrades = Array.isArray(trades)
    ? [...trades]
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
        .slice(0, maxItems)
    : [];

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">Actividad</h3>
        <Clock className="w-3 h-3 text-slate-400" />
      </div>
      
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
        {sortedTrades.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-2">Sin operaciones</p>
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
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-slate-700/20 hover:bg-slate-700/40 transition-all">
      <div className="flex items-center justify-center w-8 h-8 rounded bg-success/10 flex-shrink-0">
        <ArrowUpCircle className="w-4 h-4 text-success" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-white font-semibold">
            {trade.ticker}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {formatNumber(trade.cantidad)}
          </span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {formatCurrency(trade.precioCompra)}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="font-mono text-xs text-white">
          {formatCurrency(trade.cantidad * trade.precioCompra)}
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
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
