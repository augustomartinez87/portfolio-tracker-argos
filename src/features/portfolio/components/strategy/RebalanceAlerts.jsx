import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function RebalanceAlerts({ positions, totals, targets }) {
  const totalValuation = totals?.valuation || 0;
  if (totalValuation === 0) return null;

  const spyPos = positions.find(p => p.ticker === 'SPY');
  const ibitPos = positions.find(p => p.ticker === 'IBIT');
  const core1Val = spyPos?.valuation || 0;
  const core2Val = ibitPos?.valuation || 0;
  const satelliteVal = totalValuation - core1Val - core2Val;

  const core1Actual = (core1Val / totalValuation) * 100;
  const core2Actual = (core2Val / totalValuation) * 100;
  const satelliteActual = (satelliteVal / totalValuation) * 100;
  const satelliteTarget = Math.max(0, 100 - targets.core1 - targets.core2);

  const groups = [
    { name: 'SPY', label: 'Core 1 — SPY', target: targets.core1, actual: core1Actual },
    { name: 'IBIT', label: 'Core 2 — BTC/IBIT', target: targets.core2, actual: core2Actual },
    { name: 'Satélite', label: 'Satélite / Timba', target: satelliteTarget, actual: satelliteActual },
  ];

  const alerts = groups
    .map(g => ({ ...g, diff: g.actual - g.target }))
    .filter(g => Math.abs(g.diff) > 10);

  if (alerts.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-semibold text-text-primary">Alertas de Rebalanceo</h3>
      </div>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.name}
            className="flex items-start gap-3 p-3 bg-warning-muted border border-warning/30 rounded-lg"
          >
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                {alert.label} está{' '}
                <span className="text-warning font-bold">
                  {Math.abs(alert.diff).toFixed(1)}pp
                </span>{' '}
                {alert.diff < 0 ? 'por debajo' : 'por encima'} de tu objetivo
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {alert.diff < 0
                  ? `Considerá hacer DCA en ${alert.name} — objetivo ${alert.target.toFixed(0)}%, actual ${alert.actual.toFixed(1)}%`
                  : `Considerá tomar ganancias en ${alert.name} — objetivo ${alert.target.toFixed(0)}%, actual ${alert.actual.toFixed(1)}%`
                }
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
