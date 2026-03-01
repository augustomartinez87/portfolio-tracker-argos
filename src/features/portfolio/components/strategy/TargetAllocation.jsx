import React from 'react';
import { Target } from 'lucide-react';
import { formatARS } from '@/utils/formatters';

function AllocationRow({ name, target, actual, totalValuation, isAuto, colorClass, onChangeTarget }) {
  const diff = actual - target;
  const absDiff = Math.abs(diff);
  const progress = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const neededARS = ((target - actual) / 100) * totalValuation;

  let diffColorClass = 'text-profit';
  if (absDiff > 10) diffColorClass = 'text-loss';
  else if (absDiff > 5) diffColorClass = 'text-warning';

  return (
    <div className="bg-background-tertiary rounded-lg p-4 space-y-3">
      {/* Header: name + target input */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{name}</p>
          {isAuto && <p className="text-xs text-text-tertiary mt-0.5">Calculado automáticamente</p>}
        </div>
        <div className="flex-shrink-0">
          {isAuto ? (
            <span className="text-lg font-bold text-text-primary tabular-nums">{target.toFixed(0)}%</span>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onChangeTarget(Math.max(0, target - 5))}
                className="w-6 h-6 rounded flex items-center justify-center text-text-secondary hover:bg-background-secondary hover:text-text-primary transition-colors text-base leading-none"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                max={95}
                value={target}
                onChange={(e) => onChangeTarget(Math.max(0, Math.min(95, Number(e.target.value))))}
                className="w-14 text-center bg-background-secondary border border-border-primary rounded px-1 py-0.5 text-sm font-bold text-text-primary focus:outline-none focus:border-primary tabular-nums"
              />
              <span className="text-sm text-text-tertiary">%</span>
              <button
                onClick={() => onChangeTarget(Math.min(95, target + 5))}
                className="w-6 h-6 rounded flex items-center justify-center text-text-secondary hover:bg-background-secondary hover:text-text-primary transition-colors text-base leading-none"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-text-tertiary mb-1.5">
          <span>
            Actual:{' '}
            <span className="text-text-primary font-semibold tabular-nums">{actual.toFixed(1)}%</span>
          </span>
          <span className={`font-semibold tabular-nums ${diffColorClass}`}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}pp
          </span>
        </div>
        <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Amount needed */}
      {totalValuation > 0 && (
        <p className="text-xs text-text-tertiary">
          {Math.abs(neededARS) < 1000 ? (
            <span className="text-profit font-medium">En objetivo</span>
          ) : neededARS > 0 ? (
            <>
              Faltan{' '}
              <span className="text-text-secondary font-medium">{formatARS(neededARS)}</span>{' '}
              para alcanzar el objetivo
            </>
          ) : (
            <>
              Exceso de{' '}
              <span className="text-warning font-medium">{formatARS(Math.abs(neededARS))}</span>{' '}
              sobre el objetivo
            </>
          )}
        </p>
      )}
    </div>
  );
}

export function TargetAllocation({ positions, totals, targets, onChangeTargets }) {
  const totalValuation = totals?.valuation || 0;

  const spyPos = positions.find(p => p.ticker === 'SPY');
  const ibitPos = positions.find(p => p.ticker === 'IBIT');
  const core1Val = spyPos?.valuation || 0;
  const core2Val = ibitPos?.valuation || 0;
  const satelliteVal = totalValuation - core1Val - core2Val;

  const core1Actual = totalValuation > 0 ? (core1Val / totalValuation) * 100 : 0;
  const core2Actual = totalValuation > 0 ? (core2Val / totalValuation) * 100 : 0;
  const satelliteActual = totalValuation > 0 ? (satelliteVal / totalValuation) * 100 : 0;
  const satelliteTarget = Math.max(0, 100 - targets.core1 - targets.core2);

  const handleCore1Change = (v) => {
    const clamped = Math.min(v, 100 - targets.core2);
    onChangeTargets(prev => ({ ...prev, core1: clamped }));
  };

  const handleCore2Change = (v) => {
    const clamped = Math.min(v, 100 - targets.core1);
    onChangeTargets(prev => ({ ...prev, core2: clamped }));
  };

  const groups = [
    {
      name: 'Core 1 — SPY',
      target: targets.core1,
      actual: core1Actual,
      isAuto: false,
      colorClass: 'bg-info',
      onChangeTarget: handleCore1Change,
    },
    {
      name: 'Core 2 — BTC / IBIT',
      target: targets.core2,
      actual: core2Actual,
      isAuto: false,
      colorClass: 'bg-warning',
      onChangeTarget: handleCore2Change,
    },
    {
      name: 'Satélite / Timba',
      target: satelliteTarget,
      actual: satelliteActual,
      isAuto: true,
      colorClass: 'bg-success',
      onChangeTarget: null,
    },
  ];

  return (
    <section className="bg-background-secondary border border-border-primary rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-info" />
        <h3 className="text-base font-semibold text-text-primary">Target Allocation</h3>
        <span className="text-xs text-text-tertiary ml-1">Objetivos de portafolio</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {groups.map((g) => (
          <AllocationRow
            key={g.name}
            {...g}
            totalValuation={totalValuation}
          />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <span className="text-xs text-text-tertiary">
          Core 1 + Core 2 = {(targets.core1 + targets.core2).toFixed(0)}% → Satélite ={' '}
          <span className="text-text-secondary font-medium">{satelliteTarget.toFixed(0)}%</span>
        </span>
      </div>
    </section>
  );
}
