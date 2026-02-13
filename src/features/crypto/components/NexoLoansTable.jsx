import React, { memo } from 'react';
import { Edit2, Trash2, XCircle } from 'lucide-react';
import { formatUSDT, formatNumber, formatPercent, formatDateAR } from '@/utils/formatters';

const riskColors = {
  safe: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const riskBgColors = {
  safe: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
};

const riskLabels = {
  safe: 'OK',
  warning: 'ALERTA',
  danger: 'PELIGRO',
};

const LtvBar = ({ ltvActual, ltvWarning, ltvLiquidation }) => {
  const pct = Math.min(ltvActual * 100, 100);
  const warningPct = ltvWarning * 100;
  const liqPct = ltvLiquidation * 100;

  let barColor = 'bg-success';
  if (pct >= liqPct) barColor = 'bg-danger';
  else if (pct >= warningPct) barColor = 'bg-warning';

  return (
    <div className="w-full">
      <div className="relative h-2 bg-background-tertiary rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
        {/* Warning marker */}
        <div
          className="absolute top-0 h-full w-px bg-warning/70"
          style={{ left: `${warningPct}%` }}
          title={`Warning: ${warningPct}%`}
        />
        {/* Liquidation marker */}
        <div
          className="absolute top-0 h-full w-px bg-danger"
          style={{ left: `${liqPct}%` }}
          title={`Liquidacion: ${liqPct}%`}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-text-tertiary font-mono">{formatNumber(pct, 1)}%</span>
        <span className="text-[9px] text-text-tertiary font-mono">{formatNumber(liqPct, 0)}%</span>
      </div>
    </div>
  );
};

const NexoLoansTable = memo(({ loanMetrics = [], onEdit, onClose, onDelete }) => {
  if (!loanMetrics.length) {
    return (
      <div className="bg-background-secondary border border-border-primary rounded-xl p-8 text-center">
        <p className="text-text-tertiary text-sm">No hay prestamos activos. Crea uno para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Fecha</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Principal</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Deuda</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">APR</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Colateral</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Valor Col.</th>
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase w-32">LTV</th>
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Riesgo</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">BTC Liquidacion</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase">Costo/dia</th>
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loanMetrics.map((m) => (
              <tr key={m.loan.id} className="border-b border-border-primary/50 hover:bg-background-tertiary/50 transition-colors">
                <td className="px-3 py-2 text-text-secondary text-xs font-mono">
                  {formatDateAR(m.loan.opened_at)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">
                  {formatUSDT(m.loan.principal)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary font-medium">
                  {formatUSDT(m.loan.outstanding)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {formatNumber(m.loan.interest_rate_apr * 100, 2)}%
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {formatNumber(m.loan.collateral_quantity, 6)} {m.loan.collateral_asset === 'bitcoin' ? 'BTC' : m.loan.collateral_asset.toUpperCase()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">
                  {formatUSDT(m.collateralValueUSDT)}
                </td>
                <td className="px-3 py-2">
                  <LtvBar
                    ltvActual={m.ltvActual}
                    ltvWarning={m.loan.ltv_warning}
                    ltvLiquidation={m.loan.ltv_liquidation}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${riskBgColors[m.riskLevel]} ${riskColors[m.riskLevel]}`}>
                    {riskLabels[m.riskLevel]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-danger text-xs">
                  {formatUSDT(m.btcLiquidationPrice)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary text-xs">
                  {formatUSDT(m.dailyCostUSDT)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onEdit(m.loan)}
                      className="p-1 text-text-tertiary hover:text-primary transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {m.loan.status === 'active' && (
                      <button
                        onClick={() => onClose(m.loan)}
                        className="p-1 text-text-tertiary hover:text-warning transition-colors"
                        title="Cerrar prestamo"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(m.loan)}
                      className="p-1 text-text-tertiary hover:text-danger transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-border-primary">
        {loanMetrics.map((m) => (
          <div key={m.loan.id} className="p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-text-tertiary">{formatDateAR(m.loan.opened_at)}</span>
                <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${riskBgColors[m.riskLevel]} ${riskColors[m.riskLevel]}`}>
                  {riskLabels[m.riskLevel]}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onEdit(m.loan)} className="p-1 text-text-tertiary hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDelete(m.loan)} className="p-1 text-text-tertiary hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Deuda</span>
                <span className="font-mono text-text-primary">{formatUSDT(m.loan.outstanding)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">APR</span>
                <span className="font-mono text-text-secondary">{formatNumber(m.loan.interest_rate_apr * 100, 2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Colateral</span>
                <span className="font-mono text-text-secondary">{formatNumber(m.loan.collateral_quantity, 6)} BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Valor</span>
                <span className="font-mono text-text-primary">{formatUSDT(m.collateralValueUSDT)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Liq. Price</span>
                <span className="font-mono text-danger">{formatUSDT(m.btcLiquidationPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Costo/dia</span>
                <span className="font-mono text-text-secondary">{formatUSDT(m.dailyCostUSDT)}</span>
              </div>
            </div>

            <LtvBar
              ltvActual={m.ltvActual}
              ltvWarning={m.loan.ltv_warning}
              ltvLiquidation={m.loan.ltv_liquidation}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

NexoLoansTable.displayName = 'NexoLoansTable';
export default NexoLoansTable;
