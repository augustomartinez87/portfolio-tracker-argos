import React, { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { formatUSDT, formatARS, formatNumber, formatDateAR } from '@/utils/formatters';

const CHANNEL_LABELS = {
  binance_p2p: 'Binance P2P',
  lemoncash: 'Lemon Cash',
  buenbit: 'Buenbit',
  belo: 'Belo',
  fiwind: 'Fiwind',
  otro: 'Otro',
};

const ConversionsTable = memo(({ conversions = [], onDelete }) => {
  if (!conversions.length) {
    return (
      <div className="bg-background-secondary border border-border-primary rounded-xl p-8 text-center">
        <p className="text-text-tertiary text-sm">No hay conversiones registradas.</p>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
      {/* Desktop */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Fecha</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">USDT</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">ARS</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">TC</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Canal</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Notas</th>
              <th className="text-center px-3 py-2.5 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {conversions.map((c) => (
              <tr key={c.id} className="border-b border-border-primary/50 hover:bg-background-tertiary/50 transition-colors">
                <td className="px-3 py-2 text-text-secondary text-xs font-mono">
                  {formatDateAR(c.event_date)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">
                  {formatUSDT(c.from_amount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary font-medium">
                  {formatARS(c.to_amount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {formatNumber(c.exchange_rate, 2)}
                </td>
                <td className="px-3 py-2 text-text-secondary text-xs">
                  {CHANNEL_LABELS[c.channel] || c.channel || '-'}
                </td>
                <td className="px-3 py-2 text-text-tertiary text-xs truncate max-w-[150px]">
                  {c.notes || '-'}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => onDelete(c)}
                    className="p-1 text-text-tertiary hover:text-danger transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals row */}
          <tfoot>
            <tr className="border-t border-border-primary bg-background-tertiary/30">
              <td className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase">Total</td>
              <td className="px-3 py-2 text-right font-mono text-text-primary font-medium">
                {formatUSDT(conversions.reduce((s, c) => s + Number(c.from_amount || 0), 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-primary font-medium">
                {formatARS(conversions.reduce((s, c) => s + Number(c.to_amount || 0), 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-secondary text-xs">
                {(() => {
                  const totalUSDT = conversions.reduce((s, c) => s + Number(c.from_amount || 0), 0);
                  const totalARS = conversions.reduce((s, c) => s + Number(c.to_amount || 0), 0);
                  return totalUSDT > 0 ? formatNumber(totalARS / totalUSDT, 2) : '-';
                })()}
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile */}
      <div className="lg:hidden divide-y divide-border-primary">
        {conversions.map((c) => (
          <div key={c.id} className="p-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-tertiary">{formatDateAR(c.event_date)}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-tertiary px-1.5 py-0.5 bg-background-tertiary rounded">
                  {CHANNEL_LABELS[c.channel] || c.channel}
                </span>
                <button onClick={() => onDelete(c)} className="p-1 text-text-tertiary hover:text-danger">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-text-primary">{formatUSDT(c.from_amount)}</span>
              <span className="text-text-tertiary">→</span>
              <span className="font-mono text-text-primary font-medium">{formatARS(c.to_amount)}</span>
            </div>
            <div className="text-xs text-text-tertiary">
              TC: {formatNumber(c.exchange_rate, 2)}
              {c.notes && <span className="ml-2">· {c.notes}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ConversionsTable.displayName = 'ConversionsTable';
export default ConversionsTable;
