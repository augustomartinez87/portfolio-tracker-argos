import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { ArrowUpCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { formatNumber } from '../../utils/formatters';
import { formatARS } from '../../utils/formatters';

export function RecentActivity({ trades, maxItems = 3 }) {
  const sortedTrades = useMemo(() => {
    if (!Array.isArray(trades) return [];

    // Filtrar trades de los últimos 3 meses
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.fecha);
      return tradeDate >= threeMonthsAgo;
    });

    // Ordenar por fecha (más reciente primero)
    return [...recentTrades].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  }, [trades]);

  return (
    <Card noPadding className="overflow-hidden !max-h-[380px]">
      <div className="p-3 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-white">Actividad</h3>
          <Clock className="w-4 h-4 text-slate-400" />
        </div>

        <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {sortedTrades.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-2">Sin operaciones (últ. 3 meses)</p>
          ) : (
            sortedTrades.map((trade) => (
              <TradeItem key={trade.id} trade={trade} />
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function TradeItem({ trade }) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded bg-slate-700/20 hover:bg-slate-700/40 transition-all">
      <div className="flex items-center justify-center w-7 h-7 rounded bg-success/10 flex-shrink-0">
        <ArrowUpCircle className="w-4 h-4 text-success" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-white font-semibold truncate">
            {trade.ticker}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {formatNumber(trade.cantidad)}
          </span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {formatARS(trade.precioCompra)}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="font-mono text-xs text-white font-semibold">
          {formatARS(trade.cantidad * trade.precioCompra)}
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          {new Date(trade.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
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
