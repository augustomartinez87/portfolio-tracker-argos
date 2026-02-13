import React, { memo } from 'react';
import { Edit2, Trash2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatARS, formatUSDT, formatPercent, formatNumber } from '@/utils/formatters';

const CycleCard = memo(({
  metrics,
  isExpanded,
  onToggleExpand,
  onEdit,
  onClose,
  onDelete,
}) => {
  const isActive = metrics.status === 'active';
  const pnlPositive = metrics.pnlRealARS >= 0;

  return (
    <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary">{metrics.label}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              isActive
                ? 'bg-success/10 text-success'
                : 'bg-text-tertiary/10 text-text-tertiary'
            }`}>
              {isActive ? 'Activo' : 'Cerrado'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(metrics)} className="p-1 text-text-tertiary hover:text-primary transition-colors" title="Editar">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {isActive && (
              <button onClick={() => onClose(metrics)} className="p-1 text-text-tertiary hover:text-warning transition-colors" title="Cerrar ciclo">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => onDelete(metrics)} className="p-1 text-text-tertiary hover:text-danger transition-colors" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div>
            <p className="text-[10px] text-text-tertiary uppercase mb-0.5">P&L Real</p>
            <p className={`text-sm font-mono font-bold ${pnlPositive ? 'text-success' : 'text-danger'}`}>
              {formatARS(metrics.pnlRealARS)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary uppercase mb-0.5">ROI</p>
            <p className={`text-sm font-mono font-bold ${metrics.roiPct >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatPercent(metrics.roiPct)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary uppercase mb-0.5">Dias</p>
            <p className="text-sm font-mono font-bold text-text-primary">{metrics.diasEnCiclo}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary uppercase mb-0.5">Carry/dia</p>
            <p className={`text-sm font-mono font-bold ${metrics.carryDiarioARS >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatARS(metrics.carryDiarioARS)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary uppercase mb-0.5">Prestamo</p>
            <p className="text-sm font-mono font-bold text-text-primary">
              {formatUSDT(metrics.loanOutstandingUSDT)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary uppercase mb-0.5">TC Prom</p>
            <p className="text-sm font-mono font-bold text-text-primary">
              {formatNumber(metrics.tcPromedio, 2)}
            </p>
          </div>
        </div>

        {/* Sub-info */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-text-tertiary">
          <span>{metrics.cantConversiones} conv.</span>
          <span>{metrics.cantLots} lotes</span>
          {metrics.loanApr > 0 && <span>APR {formatNumber(metrics.loanApr * 100, 2)}%</span>}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => onToggleExpand(metrics.cycleId)}
        className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-text-tertiary hover:text-text-secondary hover:bg-background-tertiary/50 transition-colors border-t border-border-primary"
      >
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {isExpanded ? 'Cerrar detalle' : 'Ver detalle'}
      </button>
    </div>
  );
});

CycleCard.displayName = 'CycleCard';
export default CycleCard;
