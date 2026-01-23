import React from 'react';
import { formatARS, formatPercent } from '../../utils/formatters';

export const TotalCard = ({ totals, columnSettings }) => {
  const paddingY = columnSettings.density === 'compact' ? 'py-3' : 'py-3.5';
  const paddingX = 'px-3';

  return (
    <div className="bg-background-secondary border border-border-primary rounded-xl shadow-md overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed">
        <colgroup>
          <col className="w-[140px]" /> {/* Ticker */}
          <col className="w-[80px]" />  {/* Cant */}
          {columnSettings.showPPC && <col className="w-[100px]" />}  {/* PPC */}
          <col className="w-[100px]" /> {/* P. Actual */}
          <col className="w-[120px]" /> {/* Valuación */}
          {columnSettings.showInvertido && <col className="w-[110px]" />} {/* Invertido */}
          <col className="w-[120px]" /> {/* P&L $ */}
          <col className="w-[90px]" />  {/* P&L % */}
          {columnSettings.showDiario && <col className="w-[110px]" />} {/* Diario $ */}
          {columnSettings.showDiarioPct && <col className="w-[90px]" />} {/* Diario % */}
        </colgroup>
        <thead>
          <tr className="bg-background-tertiary/30 border-b border-border-primary">
            <th className={`text-left ${paddingX} py-2 text-xs font-medium text-text-tertiary`}></th>
            <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>Cant.</th>
            {columnSettings.showPPC && (
              <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>PPC</th>
            )}
            <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>P. Actual</th>
            <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>Valuación</th>
            {columnSettings.showInvertido && (
              <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>Invertido</th>
            )}
            <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>P&L $</th>
            <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>P&L %</th>
            {columnSettings.showDiario && (
              <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>Diario $</th>
            )}
            {columnSettings.showDiarioPct && (
              <th className={`text-center ${paddingX} py-2 text-xs font-medium text-text-tertiary`}>Diario %</th>
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            {/* Ticker / Label */}
            <td className={`${paddingX} ${paddingY}`}>
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-semibold text-white font-mono text-base">Total</span>
                <span className="text-[11px] text-text-tertiary font-normal">Cartera</span>
              </div>
            </td>
            {/* Cantidad */}
            <td className={`text-center ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs tabular-nums`}>
              —
            </td>
            {/* PPC */}
            {columnSettings.showPPC && (
              <td className={`text-center ${paddingX} ${paddingY} text-text-tertiary font-mono text-xs tabular-nums`}>
                —
              </td>
            )}
            {/* P. Actual */}
            <td className={`text-center ${paddingX} ${paddingY} text-text-tertiary font-mono text-sm tabular-nums`}>
              —
            </td>
            {/* Valuación */}
            <td className={`text-center ${paddingX} ${paddingY} text-text-primary font-mono text-base font-medium whitespace-nowrap tabular-nums`}>
              {formatARS(totals.valuacion)}
            </td>
            {/* Invertido */}
            {columnSettings.showInvertido && (
              <td className={`text-center ${paddingX} ${paddingY} text-text-secondary font-mono text-xs font-normal tabular-nums`}>
                {formatARS(totals.invertido)}
              </td>
            )}
            {/* P&L $ */}
            <td className={`text-center ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
              <span className={`font-mono font-semibold text-base ${totals.resultado >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatARS(totals.resultado)}
              </span>
            </td>
            {/* P&L % */}
            <td className={`text-center ${paddingX} ${paddingY}`}>
              <span className={`font-medium px-1.5 py-0.5 rounded text-sm tabular-nums ${
                totals.resultadoPct >= 0
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}>
                {formatPercent(totals.resultadoPct)}
              </span>
            </td>
            {/* P&L Diario $ */}
            {columnSettings.showDiario && (
              <td className={`text-center ${paddingX} ${paddingY} whitespace-nowrap tabular-nums`}>
                <span className={`font-mono text-sm font-medium ${totals.resultadoDiario >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatARS(totals.resultadoDiario)}
                </span>
              </td>
            )}
            {/* P&L Diario % */}
            {columnSettings.showDiarioPct && (
              <td className={`text-center ${paddingX} ${paddingY}`}>
                <span className={`font-medium px-1.5 py-0.5 rounded text-xs tabular-nums ${
                  totals.resultadoDiarioPct >= 0
                    ? 'bg-success/10 text-success'
                    : 'bg-danger/10 text-danger'
                }`}>
                  {formatPercent(totals.resultadoDiarioPct)}
                </span>
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TotalCard;
