import { useEffect, useMemo, useRef } from 'react';
import { X, Bitcoin } from 'lucide-react';
import { formatNumber, formatPercent, formatUSDT } from '@/utils/formatters';
import CryptoTradesTable from '@/features/crypto/components/CryptoTradesTable';

export default function CryptoPositionDetailModal({ open, onClose, position, trades = [], onEditTrade, onDeleteTrade }) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    previousFocusRef.current?.focus();
  }, [open, onClose]);

  const { symbol, name, assetId } = useMemo(() => {
    if (!position) return { symbol: '', name: '', assetId: '' };
    return {
      symbol: position.symbol || String(position.assetId).toUpperCase(),
      name: position.name || 'Desconocido',
      assetId: position.assetId
    };
  }, [position]);

  if (!open || !position) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div ref={modalRef} tabIndex={-1} className="bg-background-secondary rounded-xl p-6 w-full max-w-5xl border border-border-primary shadow-xl focus:outline-none">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-text-primary">{symbol}</h2>
              <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-medium rounded-full">
                CRIPTO
              </span>
            </div>
            <p className="text-sm text-text-tertiary">{name} • <span className="font-mono">{assetId}</span></p>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-background-tertiary" aria-label="Cerrar modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">Cantidad</p>
            <p className="text-sm font-mono text-text-primary">{formatNumber(position.quantity, 6)}</p>
          </div>
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">PPC</p>
            <p className="text-sm font-mono text-text-primary">{formatUSDT(position.avgPrice)}</p>
          </div>
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">P. Actual</p>
            <p className="text-sm font-mono text-text-primary">{formatUSDT(position.currentPrice)}</p>
          </div>
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">ValuaciÃ³n</p>
            <p className="text-sm font-mono text-text-primary">{formatUSDT(position.valuation)}</p>
          </div>
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">Costo</p>
            <p className="text-sm font-mono text-text-primary">{formatUSDT(position.totalCost)}</p>
          </div>
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">P&amp;L</p>
            <p className={`text-sm font-mono ${position.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatUSDT(position.pnl)}
            </p>
          </div>
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">P&amp;L %</p>
            <p className={`text-sm font-mono ${position.pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatPercent(position.pnlPct)}
            </p>
          </div>
          <div className="bg-background-tertiary rounded-lg p-3">
            <p className="text-xs text-text-tertiary">P&amp;L diario</p>
            <p className={`text-sm font-mono ${position.dailyPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatUSDT(position.dailyPnl)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Transacciones</h3>
          <CryptoTradesTable trades={trades} onEdit={onEditTrade} onDelete={onDeleteTrade} />
        </div>
      </div>
    </div>
  );
}

