import React from 'react';
import { formatARS, formatPercent } from '../../utils/formatters';

export const TotalCard = ({ totals, columnSettings }) => {
  const paddingX = 'px-3';
  const paddingY = 'py-2';

  return (
    <div className="flex items-center bg-background-secondary border border-border-primary rounded-lg p-4 shadow-md">
      <div className={`${paddingX} ${paddingY} text-text-primary pr-8 w-32`}>
        <span className="font-bold text-lg text-success">Total</span>
      </div>
      <div className={`${paddingX} ${paddingY} w-20`}></div>
      {columnSettings.showPPC && (
        <div className={`${paddingX} ${paddingY} w-24`}></div>
      )}
      <div className={`${paddingX} ${paddingY} w-24`}></div>
      <div className={`${paddingX} ${paddingY} flex-1 text-right text-text-primary font-mono font-bold text-lg tabular-nums`}>
        {formatARS(totals.valuacion)}
      </div>
      {columnSettings.showInvertido && (
        <div className={`${paddingX} ${paddingY} w-32 text-right text-text-secondary font-mono font-medium tabular-nums`}>
          {formatARS(totals.invertido)}
        </div>
      )}
      <div className={`${paddingX} ${paddingY} w-32 text-right tabular-nums`}>
        <span className={`font-mono font-bold text-lg ${totals.resultado >= 0 ? 'text-success' : 'text-danger'}`}>
          {formatARS(totals.resultado)}
        </span>
      </div>
      <div className={`${paddingX} ${paddingY} w-24 text-right`}>
        <span className={`font-bold px-2 py-0.5 rounded text-sm ${totals.resultadoPct >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {formatPercent(totals.resultadoPct)}
        </span>
      </div>
      {columnSettings.showDiario && (
        <div className={`${paddingX} ${paddingY} w-28 text-right tabular-nums`}>
          <span className={`font-mono text-sm font-medium ${totals.resultadoDiario >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatARS(totals.resultadoDiario)}
          </span>
        </div>
      )}
      {columnSettings.showDiarioPct && (
        <div className={`${paddingX} ${paddingY} w-24 text-right`}>
          <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${totals.resultadoDiarioPct >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {formatPercent(totals.resultadoDiarioPct)}
          </span>
        </div>
      )}
    </div>
  );
};

export default TotalCard;
